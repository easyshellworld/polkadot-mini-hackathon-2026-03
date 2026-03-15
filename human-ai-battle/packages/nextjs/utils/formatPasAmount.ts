import { formatEther } from "viem";

export function formatPasAmount(amount: bigint, maxDecimals = 2): string {
  const formatted = formatEther(amount);
  const [whole, fraction = ""] = formatted.split(".");

  if (maxDecimals <= 0 || fraction.length === 0) {
    return whole;
  }

  const trimmedFraction = fraction.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmedFraction.length > 0 ? `${whole}.${trimmedFraction}` : whole;
}
