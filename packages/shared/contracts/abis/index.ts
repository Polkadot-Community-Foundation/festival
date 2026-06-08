// Re-export ABIs extracted from Foundry artifacts.
// Each .json is a full Foundry artifact. We extract the .abi field.

import FestivalArtifact from './Festival.json'
import FestivalSessionArtifact from './FestivalSession.json'
import AttendancePOAPArtifact from './AttendancePOAP.json'
import NonTransferableERC721Artifact from './NonTransferableERC721.json'
import Multicall3Artifact from './Multicall3.json'

export const FestivalABI = FestivalArtifact.abi as any[]
export const FestivalSessionABI = FestivalSessionArtifact.abi as any[]
export const AttendancePOAPABI = AttendancePOAPArtifact.abi as any[]
export const NonTransferableERC721ABI = NonTransferableERC721Artifact.abi as any[]
export const Multicall3ABI = Multicall3Artifact.abi as any[]
