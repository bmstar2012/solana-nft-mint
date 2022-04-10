import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { NftMint } from "../target/types/nft_mint";

describe("nft-mint", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.NftMint as Program<NftMint>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
