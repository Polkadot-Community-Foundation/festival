/**
 * Terminal prompts + logging, built on Node's `readline` (no external deps).
 * Colours auto-disable when stdout isn't a TTY.
 */

import { createInterface } from 'node:readline/promises'
import readline from 'node:readline'

const isTTY = Boolean(process.stdout.isTTY)
const useColor = isTTY && process.env.NO_COLOR === undefined

function paint(code: string, s: string): string {
  return useColor ? `\x1b[${code}m${s}\x1b[0m` : s
}

export const c = {
  dim: (s: string) => paint('2', s),
  bold: (s: string) => paint('1', s),
  green: (s: string) => paint('32', s),
  yellow: (s: string) => paint('33', s),
  red: (s: string) => paint('31', s),
  cyan: (s: string) => paint('36', s),
  gray: (s: string) => paint('90', s),
}

const SYM = {
  ok: c.green('✓'),
  warn: c.yellow('⚠'),
  err: c.red('✗'),
  step: c.cyan('▸'),
  bullet: c.dim('•'),
  spin: c.cyan('◐'),
}

/** Print a top banner. */
export function intro(title: string): void {
  process.stdout.write('\n' + c.bold(title) + '\n')
}

/** Print a closing line. */
export function outro(msg: string): void {
  process.stdout.write('\n' + msg + '\n\n')
}

/** Phase heading, e.g. "▸ Configure". */
export function heading(title: string): void {
  process.stdout.write('\n' + SYM.step + ' ' + c.bold(title) + '\n')
}

export function log(msg = ''): void {
  process.stdout.write('  ' + msg + '\n')
}
export function success(msg: string): void {
  process.stdout.write('  ' + SYM.ok + ' ' + msg + '\n')
}
export function warn(msg: string): void {
  process.stdout.write('  ' + SYM.warn + ' ' + msg + '\n')
}
export function error(msg: string): void {
  process.stdout.write('  ' + SYM.err + ' ' + msg + '\n')
}
export function bullet(msg: string): void {
  process.stdout.write('    ' + SYM.bullet + ' ' + msg + '\n')
}
export function blank(): void {
  process.stdout.write('\n')
}

/**
 * Lightweight spinner. In a TTY it animates a single line; in non-TTY it prints
 * a start line and a result line (so CI logs stay readable). Always call one of
 * succeed/fail/info/stop to finalise.
 */
export function spinner(label: string) {
  const frames = ['◐', '◓', '◑', '◒']
  let i = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let current = label

  const render = () => {
    readline.clearLine(process.stdout, 0)
    readline.cursorTo(process.stdout, 0)
    process.stdout.write('  ' + c.cyan(frames[i = (i + 1) % frames.length]) + ' ' + current)
  }

  if (isTTY) {
    process.stdout.write('  ' + SYM.spin + ' ' + current)
    timer = setInterval(render, 120)
  } else {
    process.stdout.write('  ' + SYM.spin + ' ' + current + '\n')
  }

  const finalize = (sym: string, text: string) => {
    if (timer) {
      clearInterval(timer)
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
    }
    process.stdout.write('  ' + sym + ' ' + text + '\n')
  }

  return {
    update(text: string) {
      current = text
      if (!isTTY) process.stdout.write('  ' + SYM.spin + ' ' + text + '\n')
    },
    succeed: (text = current) => finalize(SYM.ok, text),
    fail: (text = current) => finalize(SYM.err, text),
    info: (text = current) => finalize(SYM.bullet, text),
    stop: (text = current) => finalize(c.dim('·'), text),
  }
}

// ── Prompts ──

/** Free-text prompt with optional default + validator. */
export async function text(
  question: string,
  opts: { default?: string; validate?: (v: string) => string | null } = {},
): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    for (;;) {
      const suffix = opts.default ? c.dim(` (${opts.default})`) : ''
      const answer = (await rl.question(`  ${c.cyan('?')} ${question}${suffix} `)).trim()
      const value = answer || opts.default || ''
      const err = opts.validate?.(value)
      if (err) {
        error(err)
        continue
      }
      return value
    }
  } finally {
    rl.close()
  }
}

/** Yes/no prompt. */
export async function confirm(question: string, def = true): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const hint = def ? c.dim('(Y/n)') : c.dim('(y/N)')
    const answer = (await rl.question(`  ${c.cyan('?')} ${question} ${hint} `)).trim().toLowerCase()
    if (!answer) return def
    return answer === 'y' || answer === 'yes'
  } finally {
    rl.close()
  }
}

export interface Choice<T> {
  label: string
  value: T
  hint?: string
}

/** Single-select list. Returns the chosen value. */
export async function select<T>(question: string, choices: Choice<T>[]): Promise<T> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    process.stdout.write(`  ${c.cyan('?')} ${question}\n`)
    choices.forEach((ch, idx) => {
      const hint = ch.hint ? c.dim(`  ${ch.hint}`) : ''
      process.stdout.write(`     ${c.bold(String(idx + 1))}) ${ch.label}${hint}\n`)
    })
    for (;;) {
      const answer = (await rl.question(`  ${c.dim(`1-${choices.length}`)} › `)).trim()
      const n = Number(answer)
      if (Number.isInteger(n) && n >= 1 && n <= choices.length) {
        return choices[n - 1].value
      }
      error(`Enter a number between 1 and ${choices.length}.`)
    }
  } finally {
    rl.close()
  }
}

/** Masked secret prompt (input is hidden behind '*'). */
export function password(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const prompt = `  ${c.cyan('?')} ${question} `
    // Mute echo: print the prompt once, then '*' for each typed character.
    let promptShown = false
    ;(rl as any)._writeToOutput = (str: string) => {
      if (!promptShown) {
        ;(rl as any).output.write(prompt)
        promptShown = true
        return
      }
      if (str.includes('\n')) (rl as any).output.write('\n')
      else (rl as any).output.write('*')
    }
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}
