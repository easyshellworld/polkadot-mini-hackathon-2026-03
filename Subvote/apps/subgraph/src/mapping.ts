import { VoteCast as VoteCastEvent } from "../generated/SubvoteContract/SubvoteContract";
import { VoteCast } from "../generated/schema";

export function handleVoteCast(event: VoteCastEvent): void {
  const entity = new VoteCast(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  );

  entity.proposalId = event.params.proposalId;
  entity.voter = event.params.voter;
  entity.choice = event.params.choice;
  entity.transactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}
