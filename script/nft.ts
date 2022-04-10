import * as anchor from '@project-serum/anchor';
import {clusterApiUrl, Connection, Keypair, PublicKey, SystemProgram} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MintLayout,
  Token,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
// @ts-ignore
import { program } from 'commander';
import {createAssociatedTokenAccountInstruction, loadWalletKey} from "../src/helper/solana";


const NFT_MINT_PROGRAM_ID = process.env.NFT_MINT_PROGRAM_ID;

const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

const idl = require('../idl/nft_mint.json');
const NFT_MINT_PDA_SEED = 'mint';

async function mintNft(
  recipient: string,
  name: string,
  symbol: string,
  uri: string,
  connection: Connection,
  keypair: Keypair,
) {
  try {
    let serviceKeypair = keypair;

    const recipientPubkey = new PublicKey(recipient);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const walletWrapper = new anchor.Wallet(serviceKeypair);
    const provider = new anchor.Provider(connection, walletWrapper, {
      preflightCommitment: 'recent',
    });

    const program = new anchor.Program(
      idl,
      new PublicKey(NFT_MINT_PROGRAM_ID as string),
      provider,
    );

    const mintKey = Keypair.generate();
    const recipientAssTokenKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintKey.publicKey,
      recipientPubkey,
    );

    const instructions = [
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: serviceKeypair.publicKey,
        newAccountPubkey: mintKey.publicKey,
        space: MintLayout.span,
        lamports: await connection.getMinimumBalanceForRentExemption(
          MintLayout.span,
        ),
        programId: TOKEN_PROGRAM_ID,
      }),
      Token.createInitMintInstruction(
        TOKEN_PROGRAM_ID,
        mintKey.publicKey,
        0,
        serviceKeypair.publicKey,
        serviceKeypair.publicKey,
      ),
      createAssociatedTokenAccountInstruction(
        recipientAssTokenKey,
        serviceKeypair.publicKey,
        recipientPubkey,
        mintKey.publicKey,
      ),
      Token.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        mintKey.publicKey,
        recipientAssTokenKey,
        serviceKeypair.publicKey,
        [],
        1,
      ),
    ];

    const [configKey, configNonce] = await PublicKey.findProgramAddress(
      [Buffer.from(NFT_MINT_PDA_SEED)],
      new PublicKey(NFT_MINT_PROGRAM_ID as string),
    );

    const [metadataKey] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintKey.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID,
    );

    const [masterKey] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintKey.publicKey.toBuffer(),
        Buffer.from('edition'),
      ],
      TOKEN_METADATA_PROGRAM_ID,
    );

    const signers = [mintKey, serviceKeypair];
    const txId = await program.rpc.mintingNft(configNonce, name, symbol, uri, {
      accounts: {
        signer: serviceKeypair.publicKey,
        configuration: configKey,
        mint: mintKey.publicKey,
        metadata: metadataKey,
        masteredition: masterKey,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        recentBlockhashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
        instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      },
      instructions,
      signers
    });

    return {
      success: true,
      tx_id: txId,
      nft_address: mintKey.publicKey.toString(),
    };
  } catch (e: any) {
    return { success: false, tx_id: null };
  }
}

program.command('mint')
  .option(
    '-e, --env <string>',
    'Solana cluster env name. One of: mainnet-beta, testnet, devnet',
    'mainnet-beta',
  )
  .requiredOption('-k, --keypair <path>', `Solana wallet location`)
  .action(async (_directory: any, cmd: any) => {
    const { env, keypair } = cmd.opts();
    const serviceKeypair = loadWalletKey(keypair);
    const cluster = clusterApiUrl(env);
    const connection = new Connection(cluster);

    const name = `NFT name`;
    const symbol = `NFT symbol`;
    const uri = `metadata URI`;
    const recipient = `<recipient Wallet address>`;
    const result = await mintNft(
      recipient,
      name,
      symbol,
      uri,
      connection,
      serviceKeypair,
    );
    console.log(`NFT address: ${result.nft_address}`);
  });

program.parse(process.argv);
