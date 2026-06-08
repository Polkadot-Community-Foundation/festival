"""
SVG → GeoJSON converter for the venue map.

Iterates over `packages/shared/public/floorplans/source/*.svg`, emits a
GeoJSON for each, and additionally label-strips the outdoor SVG into
`venue-overlay.svg` for the MapLibre engine's overlay layer.

Run via: `npm run build:maps`. Requires Python 3 with `svgpathtools` and
`shapely` installed:

    pip install svgpathtools shapely

Figma tag convention (lifted from ref/new-map-docs/HANDOFF.md):

  - `<Display Name> #tag1 #tag2`  e.g. `Studio 1 #zone #forbidden`
  - Structural tags: #zone, #structure, #scenery, #decoration, #mask,
    #main-building
  - Behavioural tags: #forbidden, #no-name
  - Spot markers: a group whose name matches a zone's name, containing a
    centered <text>. Position auto-overridden via polylabel.

Output filename mapping (mirrors `floors.ts` ids):

  source/site.svg              → venue.geojson + venue-overlay.svg
  source/block-b-ground.svg    → block-b-first-ground.geojson
  source/block-b-first-floor.svg → block-b-first-floor.geojson
"""

import json
import math
import os
import re
import sys
import xml.etree.ElementTree as ET

try:
    from svgpathtools import parse_path
except ImportError:
    print("error: missing dependency 'svgpathtools'. Install with: pip install svgpathtools shapely", file=sys.stderr)
    sys.exit(1)

try:
    from shapely.geometry import shape, mapping, Polygon as ShPoly, Point
    from shapely.ops import unary_union
except ImportError:
    print("error: missing dependency 'shapely'. Install with: pip install svgpathtools shapely", file=sys.stderr)
    sys.exit(1)

import heapq

# ── Tunables ──
SAMPLE_STEP = 4.0
SIMPLIFY_TOL = 0.2
MASK_BUFFER_INWARD = 1.0

# Repo-rooted paths (script lives at <repo>/scripts/).
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE_DIR = os.path.join(REPO_ROOT, "packages/shared/public/floorplans/source")
OUT_DIR = os.path.join(REPO_ROOT, "packages/shared/public/floorplans")

# Source filename → (floorId, output geojson basename).
# floorId matches `packages/shared/venue/floors.ts` ids.
FLOOR_MAPPING = {
    "site.svg": ("venue", "venue.geojson"),
    "block-b-ground.svg": ("block-b-first-ground", "block-b-first-ground.geojson"),
    "block-b-first-floor.svg": ("block-b-first-floor", "block-b-first-floor.geojson"),
}

# Outdoor source: additionally emits a label-stripped overlay SVG.
OUTDOOR_SOURCE = "site.svg"
OUTDOOR_OVERLAY_OUT = "venue-overlay.svg"


# ════════════════════════════════════════════════════════════════════════
# Parsing helpers
# ════════════════════════════════════════════════════════════════════════

def split_name_and_tags(raw):
    """'Studio 1 #zone #forbidden' -> ('Studio 1', ['zone', 'forbidden'])"""
    if not raw:
        return None, []
    parts = raw.split('#')
    name = parts[0].strip() or None
    tags = []
    for t in parts[1:]:
        t = t.strip()
        t = re.sub(r'_\d+$', '', t)  # strip Figma '_2' disambiguation
        if t:
            tags.append(t)
    return name, tags


def tag(elem):
    return elem.tag.split('}')[-1]


def get_text_content(text_elem):
    parts = []
    if text_elem.text:
        parts.append(text_elem.text)
    for child in text_elem.iter():
        if tag(child) == 'tspan' and child.text:
            parts.append(child.text)
        if child.tail:
            parts.append(child.tail)
    return ''.join(parts).strip()


def text_position(text_elem):
    x = text_elem.get('x')
    y = text_elem.get('y')
    if x is None or y is None:
        for c in text_elem.iter():
            if tag(c) == 'tspan':
                x = x or c.get('x')
                y = y or c.get('y')
                if x and y:
                    break
    try:
        return float(x), float(y)
    except (TypeError, ValueError):
        return None


# ════════════════════════════════════════════════════════════════════════
# Geometry
# ════════════════════════════════════════════════════════════════════════

def flatten_path(d, vb_h, sample_step=SAMPLE_STEP, simplify_tol=SIMPLIFY_TOL):
    """SVG d-attr → list of (geometry, kind) tuples."""
    subpath_strs = [s for s in re.split(r'(?=[Mm])', d.strip()) if s.strip()]
    out = []
    for sub in subpath_strs:
        is_closed = bool(re.search(r'[Zz]', sub))
        try:
            path = parse_path(sub)
        except Exception:
            continue
        ring = []
        for seg in path:
            try:
                length = max(seg.length(error=1e-2), 1.0)
            except Exception:
                length = 10.0
            n = max(1, int(length / sample_step))
            for i in range(n + 1):
                t = i / n
                try:
                    pt = seg.point(t)
                except Exception:
                    continue
                x = pt.real
                y = vb_h - pt.imag  # Y-flip
                if ring and ring[-1] == [x, y]:
                    continue
                ring.append([x, y])
        if len(ring) < 2:
            continue
        simplified = rdp(ring, simplify_tol)
        if is_closed:
            if simplified[0] != simplified[-1]:
                simplified.append(simplified[0])
            if len(simplified) >= 4:
                out.append(([simplified], 'polygon'))
        else:
            if len(simplified) >= 2:
                out.append((simplified, 'line'))
    return out


def rdp(points, epsilon):
    """Iterative Douglas-Peucker simplification."""
    if len(points) < 3:
        return points[:]
    keep = [False] * len(points)
    keep[0] = True
    keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        s, e = stack.pop()
        if e <= s + 1:
            continue
        x1, y1 = points[s]
        x2, y2 = points[e]
        dx, dy = x2 - x1, y2 - y1
        seg_sq = dx * dx + dy * dy
        max_d = 0.0
        max_i = s
        for i in range(s + 1, e):
            x0, y0 = points[i]
            if seg_sq < 1e-9:
                d = ((x0 - x1) ** 2 + (y0 - y1) ** 2) ** 0.5
            else:
                d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / (seg_sq ** 0.5)
            if d > max_d:
                max_d = d
                max_i = i
        if max_d > epsilon:
            keep[max_i] = True
            stack.append((s, max_i))
            stack.append((max_i, e))
    return [points[i] for i, k in enumerate(keep) if k]


def apply_transform_point(x, y, transform):
    """Apply the small SVG transform subset Figma emits in our map exports."""
    if not transform:
        return x, y
    out_x, out_y = x, y
    for name, args_raw in re.findall(r'([a-zA-Z]+)\(([^)]*)\)', transform):
        args = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?(?:e[-+]?\d+)?', args_raw)]
        if name == 'rotate' and args:
            angle = math.radians(args[0])
            cx = args[1] if len(args) >= 3 else 0.0
            cy = args[2] if len(args) >= 3 else 0.0
            cos_a = math.cos(angle)
            sin_a = math.sin(angle)
            dx = out_x - cx
            dy = out_y - cy
            out_x = cx + dx * cos_a - dy * sin_a
            out_y = cy + dx * sin_a + dy * cos_a
        elif name == 'translate':
            out_x += args[0] if len(args) >= 1 else 0.0
            out_y += args[1] if len(args) >= 2 else 0.0
    return out_x, out_y


def rect_rings(rect, vb_h):
    x = float(rect.get('x', 0))
    y = float(rect.get('y', 0))
    w = float(rect.get('width', 0))
    h = float(rect.get('height', 0))
    if w <= 0 or h <= 0:
        return []
    transform = rect.get('transform')
    corners = [
        (x, y),
        (x + w, y),
        (x + w, y + h),
        (x, y + h),
        (x, y),
    ]
    ring = []
    for px, py in corners:
        tx, ty = apply_transform_point(px, py, transform)
        ring.append([tx, vb_h - ty])
    return [ring]


# ════════════════════════════════════════════════════════════════════════
# Traversal
# ════════════════════════════════════════════════════════════════════════

def collect_features(svg_path):
    tree = ET.parse(svg_path)
    root = tree.getroot()
    vb = root.get('viewBox').split()
    vb_w, vb_h = float(vb[2]), float(vb[3])

    # Pre-scan <defs> for Gaussian-blur filter ids.
    filter_blurs = {}
    for el in root.iter():
        if tag(el) == 'filter':
            fid = el.get('id')
            if not fid:
                continue
            for child in el.iter():
                if tag(child) == 'feGaussianBlur':
                    sd = child.get('stdDeviation')
                    if sd:
                        try:
                            filter_blurs[fid] = float(sd)
                        except ValueError:
                            pass
                    break

    # Outer frame name for chrome filtering.
    frame_name = None
    for child in root:
        if tag(child) == 'g':
            cid = child.get('id', '')
            n, _ = split_name_and_tags(cid)
            frame_name = n
            break

    features = []

    def visit(el, inherited_name=None, inherited_tags=None,
              inherited_blur=None, inherited_blend=None):
        inherited_tags = list(inherited_tags or [])

        my_name, my_tags = split_name_and_tags(el.get('id', ''))

        AUTO_NAME_PATTERNS = (
            r'^Vector( \d+)?$', r'^Path( \d+)?$',
            r'^Rectangle( \d+)?$', r'^Group \d+$',
            r'^Union(_\d+)?$', r'^Ellipse( \d+)?$',
        )
        if my_name and not my_tags:
            if any(re.match(p, my_name) for p in AUTO_NAME_PATTERNS):
                my_name = None

        effective_name = my_name or inherited_name
        effective_tags = my_tags if my_tags else inherited_tags

        my_filter = el.get('filter')
        my_blur = inherited_blur
        if my_filter:
            m = re.match(r'url\(#([^)]+)\)', my_filter)
            if m and m.group(1) in filter_blurs:
                my_blur = filter_blurs[m.group(1)]

        my_blend = inherited_blend
        style_attr = el.get('style') or ''
        blend_match = re.search(r'mix-blend-mode\s*:\s*([a-z-]+)', style_attr)
        if blend_match:
            my_blend = blend_match.group(1)

        t = tag(el)

        if t == 'mask' or t == 'defs':
            return

        if t in ('path', 'rect'):
            emit_geometry(el, effective_name, effective_tags, vb_h, features,
                          blur=my_blur, blend=my_blend)
            return

        if t == 'text':
            text_name = inherited_name or my_name
            emit_label(el, text_name, effective_tags, vb_h, features, frame_name)
            return

        if t in ('g', 'svg'):
            for child in el:
                visit(child, effective_name, effective_tags, my_blur, my_blend)

    visit(root)
    return features, vb_w, vb_h


def emit_geometry(el, name, tags, vb_h, out, blur=None, blend=None):
    t = tag(el)
    fill = el.get('fill', None)
    stroke = el.get('stroke', None)
    fill_opacity = el.get('fill-opacity')
    stroke_opacity = el.get('stroke-opacity')
    opacity = el.get('opacity')

    if fill in (None, 'none') and stroke in (None, 'none'):
        return
    if fill in (None, 'none') and not tags:
        return
    if not tags and not name:
        return
    if not tags:
        return

    if t == 'path':
        d = el.get('d')
        if not d:
            return
        results = flatten_path(d, vb_h)
    elif t == 'rect':
        results = [(rect_rings(el, vb_h), 'polygon')] if rect_rings(el, vb_h) else []
    else:
        return

    if not results:
        return

    polygons = [item[0] for item in results if item[1] == 'polygon']
    lines = [item[0] for item in results if item[1] == 'line']

    if fill and fill != 'none':
        if not polygons:
            return
        if len(polygons) == 1:
            geom = {"type": "Polygon", "coordinates": polygons[0]}
        else:
            geom = {"type": "MultiPolygon", "coordinates": polygons}
    else:
        line_strings = list(lines)
        for poly_rings in polygons:
            for ring in poly_rings:
                line_strings.append(ring)
        if not line_strings:
            return
        if len(line_strings) == 1:
            geom = {"type": "LineString", "coordinates": line_strings[0]}
        else:
            geom = {"type": "MultiLineString", "coordinates": line_strings}

    def opacity_value(s):
        return float(s) if s is not None else None

    fill_opacity_value = opacity_value(fill_opacity)
    stroke_opacity_value = opacity_value(stroke_opacity)
    element_opacity_value = opacity_value(opacity)
    if element_opacity_value is not None:
        fill_opacity_value = (
            element_opacity_value if fill_opacity_value is None
            else fill_opacity_value * element_opacity_value
        )
        stroke_opacity_value = (
            element_opacity_value if stroke_opacity_value is None
            else stroke_opacity_value * element_opacity_value
        )

    props = {
        "name": name,
        "tags": tags,
        "id": slug(name) if name else None,
        "fill": fill if (fill and fill != 'none') else None,
        "stroke": stroke if (stroke and stroke != 'none') else None,
        "strokeWidth": float(el.get('stroke-width')) if el.get('stroke-width') else None,
        "fillOpacity": fill_opacity_value,
        "strokeOpacity": stroke_opacity_value,
        "blur": blur,
        "blend": blend,
    }
    props = {k: v for k, v in props.items() if v is not None or k == 'tags'}
    out.append({"type": "Feature", "geometry": geom, "properties": props})


def emit_label(el, name, tags, vb_h, out, frame_name=None):
    text = get_text_content(el)
    pos = text_position(el)
    if not text or not pos:
        return
    name_stripped = re.sub(r'_\d+$', '', name) if name else name
    if name_stripped and frame_name and name_stripped == frame_name:
        return
    if not name:
        return
    x, y = pos
    out.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [x, vb_h - y]},
        "properties": {
            "name": text,
            "tags": ["label"] + (tags or []),
            "id": slug(text),
            "fill": None,
            "stroke": None,
        },
    })


def slug(name):
    """Stable id derived from a display name (lowercase, hyphenated)."""
    if not name:
        return None
    s = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return s or None


# ════════════════════════════════════════════════════════════════════════
# Mask clipping
# ════════════════════════════════════════════════════════════════════════

def clip_zones_by_mask(features, buffer_inward=2.0):
    mask_geoms = []
    output = []
    for f in features:
        tags = set(f['properties'].get('tags', []))
        if 'mask' in tags:
            try:
                mask_geoms.append(shape(f['geometry']))
            except Exception as e:
                print(f'  warning: could not parse mask geometry: {e}')
            continue
        output.append(f)

    if not mask_geoms:
        return output

    mask = unary_union(mask_geoms)
    if not mask.is_valid:
        mask = mask.buffer(0)

    if buffer_inward and buffer_inward > 0:
        try:
            mask = mask.buffer(-buffer_inward, join_style=2, mitre_limit=10)
            if mask.is_empty:
                print(f'  warning: buffer_inward={buffer_inward} eliminated the entire mask; using unbuffered')
                mask = unary_union(mask_geoms)
        except Exception as e:
            print(f'  warning: buffer failed: {e}; using unbuffered mask')

    clipped = []
    for f in output:
        tags = set(f['properties'].get('tags', []))
        if 'zone' not in tags:
            clipped.append(f)
            continue
        try:
            geom = shape(f['geometry'])
            if not geom.is_valid:
                geom = geom.buffer(0)
            inter = geom.intersection(mask)
            if inter.is_empty:
                continue
            new_feat = dict(f)
            new_feat['geometry'] = mapping(inter)
            clipped.append(new_feat)
        except Exception as e:
            print(f"  warning: could not clip {f['properties'].get('name')}: {e}")
            clipped.append(f)
    return clipped


# ════════════════════════════════════════════════════════════════════════
# Label auto-positioning (polylabel, pole of inaccessibility)
# ════════════════════════════════════════════════════════════════════════

def polylabel(polygon_coords, precision=1.0):
    try:
        poly = ShPoly(polygon_coords[0], holes=polygon_coords[1:] or None)
    except Exception:
        return None
    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.is_empty:
        return None

    minx, miny, maxx, maxy = poly.bounds
    cell_size = min(maxx - minx, maxy - miny)
    if cell_size == 0:
        return [minx, miny]
    h = cell_size / 2.0

    def cell_distance(cx, cy):
        pt = Point(cx, cy)
        d = poly.exterior.distance(pt)
        for ring in poly.interiors:
            d = min(d, ring.distance(pt))
        return d if poly.contains(pt) else -d

    centroid = poly.centroid
    best_x, best_y = centroid.x, centroid.y
    best_d = cell_distance(best_x, best_y)

    queue = []
    counter = [0]

    def push(cx, cy, half, dist):
        max_dist = dist + half * 1.4142135623730951
        counter[0] += 1
        heapq.heappush(queue, (-max_dist, counter[0], cx, cy, half, dist))

    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            cx, cy = x + h, y + h
            d = cell_distance(cx, cy)
            if d > best_d:
                best_d = d
                best_x, best_y = cx, cy
            push(cx, cy, h, d)
            y += cell_size
        x += cell_size

    while queue:
        neg_max, _, cx, cy, half, dist = heapq.heappop(queue)
        if -neg_max - best_d <= precision:
            continue
        half /= 2
        for dx, dy in ((-half, -half), (half, -half), (-half, half), (half, half)):
            ncx, ncy = cx + dx, cy + dy
            nd = cell_distance(ncx, ncy)
            if nd > best_d:
                best_d = nd
                best_x, best_y = ncx, ncy
            push(ncx, ncy, half, nd)

    return [best_x, best_y]


def auto_position_labels(features):
    def norm(s):
        return re.sub(r'[^a-z0-9]', '', (s or '').lower())

    zones_by_name = {}
    for f in features:
        if 'zone' in f['properties'].get('tags', []):
            n = norm(f['properties'].get('name'))
            if n and n not in zones_by_name:
                zones_by_name[n] = f['geometry']

    relocated = 0
    for f in features:
        if 'label' not in f['properties'].get('tags', []):
            continue
        label_text = f['properties'].get('name', '').replace('\n', ' ')
        n = norm(label_text)
        if n not in zones_by_name:
            continue
        zone_geom = zones_by_name[n]
        rings = []
        if zone_geom['type'] == 'Polygon':
            rings = zone_geom['coordinates']
        elif zone_geom['type'] == 'MultiPolygon':
            largest = max(zone_geom['coordinates'],
                          key=lambda poly: ShPoly(poly[0]).area)
            rings = largest
        else:
            continue
        center = polylabel(rings, precision=1.0)
        if center:
            f['geometry']['coordinates'] = center
            relocated += 1
    return relocated


def apply_outdoor_hand_tweaks(features, floor_id):
    """Apply source-specific visual cleanup that should survive regeneration."""
    if floor_id != "venue":
        return

    for feat in features:
        props = feat.get("properties", {})
        name = props.get("name")
        if not isinstance(name, str):
            continue
        props["name"] = (
            name
            .replace("ZOO BERLIN", "ZUBERLIN")
            .replace("Zoo Berlin", "ZuBerlin")
            .replace("Zoo Camping Berlin", "ZuBerlin Camping")
        )

    for idx, feat in enumerate(features):
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        if props.get("name") != "Base" or geom.get("type") != "Polygon":
            continue

        ring = geom.get("coordinates", [[]])[0]
        if len(ring) < 106 or "stroke" not in props:
            return

        props["fill"] = "#424242"
        props.pop("stroke", None)
        props.pop("strokeWidth", None)
        props.pop("strokeOpacity", None)

        # The source Base polygon has a concave Pool & Paddel notch sequence.
        # Stroking that polygon draws an unwanted inner border there, so render
        # the Base outline explicitly and skip the notch segments.
        outline_props = {
            "name": "Base outline",
            "tags": ["structure", "outline"],
            "stroke": "#000000",
            "strokeWidth": 5,
            "strokeOpacity": 0.12,
        }

        features.insert(idx + 1, {
            "type": "Feature",
            "geometry": {
                "type": "MultiLineString",
                "coordinates": [
                    ring[:72],
                    ring[96:106],
                ],
            },
            "properties": outline_props,
        })
        return


# ════════════════════════════════════════════════════════════════════════
# Outdoor overlay SVG (label-stripped, Vector 134 removed)
# ════════════════════════════════════════════════════════════════════════

def strip_overlay_svg(svg_text):
    """Produce the overlay SVG from a source: strip <text>, remove the heavy
    Vector 134 blur group (its filter dominates zoom-frame cost and the path
    is visually masked anyway), set preserveAspectRatio="none".
    """
    svg = re.sub(r'<text\b[^>]*>.*?</text>', '', svg_text, flags=re.DOTALL)
    prev = None
    while prev != svg:
        prev = svg
        svg = re.sub(r'<g\b[^>]*>\s*</g>', '', svg)

    def set_par(m):
        a = m.group(1)
        if 'preserveAspectRatio' in a:
            return '<svg' + re.sub(r'preserveAspectRatio="[^"]*"', 'preserveAspectRatio="none"', a) + '>'
        return '<svg' + a + ' preserveAspectRatio="none">'
    svg = re.sub(r'<svg([^>]*)>', set_par, svg, count=1)

    svg = re.sub(r'<g id="Vector 134"[^>]*>.*?</g>', '', svg, flags=re.DOTALL)
    svg = re.sub(r'<filter id="filter0_f[^"]*"[^>]*>.*?</filter>', '', svg, flags=re.DOTALL)
    return svg


# ════════════════════════════════════════════════════════════════════════
# Per-file conversion driver
# ════════════════════════════════════════════════════════════════════════

def convert_one(svg_path, floor_id, out_geojson_path):
    print(f'─── {os.path.basename(svg_path)} → {os.path.basename(out_geojson_path)} ({floor_id})')
    features, vb_w, vb_h = collect_features(svg_path)

    features = clip_zones_by_mask(features, buffer_inward=MASK_BUFFER_INWARD)
    relocated = auto_position_labels(features)
    if relocated:
        print(f'  auto-positioned {relocated} label(s)')

    apply_outdoor_hand_tweaks(features, floor_id)

    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "floorId": floor_id,
            "viewbox_width": vb_w,
            "viewbox_height": vb_h,
            "flatten_sample_step": SAMPLE_STEP,
            "simplify_tolerance_px": SIMPLIFY_TOL,
        },
        "features": features,
    }
    with open(out_geojson_path, 'w') as f:
        json.dump(geojson, f, separators=(",", ":"))

    by_tag = {}
    for feat in features:
        for t in feat['properties'].get('tags', []):
            by_tag[t] = by_tag.get(t, 0) + 1
    print(f'  features: {len(features)}  by tag: {by_tag}')
    print(f'  size: {os.path.getsize(out_geojson_path):,} bytes')


# ════════════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════════════

def main():
    if not os.path.isdir(SOURCE_DIR):
        print(f'error: source directory not found: {SOURCE_DIR}', file=sys.stderr)
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)

    found = 0
    for filename, (floor_id, out_name) in FLOOR_MAPPING.items():
        src = os.path.join(SOURCE_DIR, filename)
        if not os.path.isfile(src):
            print(f'  skip {filename} (not found at {src})')
            continue
        out_path = os.path.join(OUT_DIR, out_name)
        convert_one(src, floor_id, out_path)
        found += 1

    if not found:
        print('error: no source SVGs found', file=sys.stderr)
        sys.exit(1)

    # Outdoor overlay SVG (label-stripped).
    outdoor_src = os.path.join(SOURCE_DIR, OUTDOOR_SOURCE)
    if os.path.isfile(outdoor_src):
        with open(outdoor_src) as f:
            svg_text = f.read()
        overlay = strip_overlay_svg(svg_text)
        overlay_out = os.path.join(OUT_DIR, OUTDOOR_OVERLAY_OUT)
        with open(overlay_out, 'w') as f:
            f.write(overlay)
        print(f'─── {OUTDOOR_SOURCE} → {OUTDOOR_OVERLAY_OUT} (label-stripped overlay)')
        print(f'  size: {os.path.getsize(overlay_out):,} bytes')


if __name__ == '__main__':
    main()
