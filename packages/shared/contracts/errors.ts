/**
 * Map contract custom error selectors to user-friendly messages.
 * Selectors are the first 4 bytes of keccak256(errorSignature).
 */

const ERROR_MESSAGES: Record<string, string> = {
  // Festival
  "3a81d6fc": "You are already registered for this festival.",
  aba47339: "You are not registered for this festival.",
  c98289f0: "Already checked-in.",
  fb8e7ec2: "This festival is full.",
  "0f470fbc": "This festival has been cancelled.",
  "27a3513f": "Capacity cannot be set below current registered count.",
  "11b61b6a": "This festival is already configured.",
  d12c2ca4: "Sessions are disabled for this festival.",
  "95138e23": "You are not authorized to create sessions.",
  cd141a04: "Session starts before the festival.",
  b6e0293b: "Session ends after the festival.",
  "712fb959": "Address is not a session of this festival.",
  "53ba4669": "You have reached the maximum sessions per day.",
  "8cbb3b53": "You are not authorized to cancel this session.",
  "536a71af": "End time must be after start time.",
  "2b265518": "This session is already cancelled.",

  // FestivalSession
  ea8e4eb5: "Not authorized.",
  bfd2ab39: "Creator already initialized.",
  "25cab291": "You must hold a festival POAP to flag this session.",
  "031eeff2": "You have already flagged this session.",
  "0881edc7": "You cannot flag your own session.",
  "15709086": "Attendee must be checked in to the festival before checking in to a session.",

  // AttendancePOAP
  "0c6d42ae": "Only the factory can perform this action.",
  "65592be4": "Only authorized minters can mint POAPs.",
  "6027d27e": "This minter is already authorized.",

  // NonTransferableERC721
  "9cbe2357": "This token cannot be transferred.",

  // OpenZeppelin AccessControl
  e2517d3f: "You do not have the required role for this action.",

  // OpenZeppelin ERC721
  "64a0ae92": "Invalid token receiver.",
  "7e273289": "Token does not exist.",
};

/**
 * Decode a contract error from revert data into a user-friendly message.
 * Falls back to a generic message if the selector is unknown.
 */
export function decodeContractError(errorData: string): string {
  if (!errorData || errorData.length < 10) {
    return "Transaction failed with an unknown error.";
  }

  // Extract the 4-byte selector (skip 0x prefix)
  const selector = errorData.slice(2, 10).toLowerCase();
  return (
    ERROR_MESSAGES[selector] || `Transaction failed (error: 0x${selector}).`
  );
}

/**
 * Extract a user-friendly message from a thrown error.
 * Handles PAPI dispatch errors, raw revert data, and generic errors.
 */
export function formatTxError(error: unknown): string {
  if (!error) return "Unknown error.";

  const msg = error instanceof Error ? error.message : String(error);

  // Try to extract revert data from the error message
  const revertMatch = msg.match(/0x[0-9a-fA-F]{8,}/);
  if (revertMatch) {
    return decodeContractError(revertMatch[0]);
  }

  // Common PAPI dispatch errors. Try to extract specifics from the JSON
  if (msg.includes("Module")) {
    try {
      const jsonStr = msg.replace(/^.*?(\{)/, "$1");
      const parsed = JSON.parse(jsonStr);
      const palletName = parsed?.value?.type;
      const errorName = parsed?.value?.value?.type;
      if (palletName === "Revive") {
        if (errorName === "ContractReverted")
          return "The contract call reverted. Check that you have the required role and the attendee is in the correct state.";
        if (errorName === "ContractTrapped")
          return "Contract execution trapped (out of gas or runtime error).";
        return `Contract execution failed: ${errorName || "unknown Revive error"}.`;
      }
      if (palletName && errorName)
        return `Transaction failed: ${palletName}::${errorName}.`;
    } catch {}
    return "Transaction failed due to a chain module error.";
  }

  if (msg.includes("timed out")) {
    return "Transaction timed out. Please try again.";
  }

  if (msg.includes("cancelled") || msg.includes("rejected")) {
    return "Transaction was cancelled.";
  }

  return msg.length > 100 ? msg.slice(0, 100) + "…" : msg;
}
