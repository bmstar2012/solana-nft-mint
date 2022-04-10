// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY} from "@solana/web3.js";
const anchor = require("@project-serum/anchor");

module.exports = async function (provider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);
  const program = anchor.workspace.NftMint;

  const NFT_MINT_PDA_SEED = "mint";
  let configKey, configNonce;

  const update_authority = provider.wallet.publicKey;
  [configKey, configNonce] = await PublicKey.findProgramAddress(
    [Buffer.from(NFT_MINT_PDA_SEED)],
    program.programId
  );

  try {
    const tx = await program.rpc.initialize(
      configNonce,
      update_authority,
      {
        accounts: {
          signer: provider.wallet.publicKey,
          configuration: configKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        },
        // @ts-ignore
        signers: [provider.wallet.payer],
      });

    console.log("tx: ", tx);
  } catch(e) {
    console.log(e);
  }
};
