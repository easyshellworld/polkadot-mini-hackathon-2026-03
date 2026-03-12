import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TEN_ETH = 10n * 10n ** 18n;

export default buildModule("AceAirCombatModule", (m) => {
  const aceAirCombat = m.contract("AceAirCombat");

  m.call(aceAirCombat, "initializePrizePool", [], {
    value: TEN_ETH,
  });

  return { aceAirCombat };
});
