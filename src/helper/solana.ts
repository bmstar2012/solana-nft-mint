// noinspection ExceptionCaughtLocallyJS,JSDeprecatedSymbols,ES6MissingAwait

import fs from 'fs';
import {
  Blockhash,
  Connection,
  FeeCalculator,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

type Creator = {
  address: string;
  verified: number;
  share: number;
};

export type TokenMeta = {
  metaKey: string;
  mintMetaData: {
    key: number;
    updateAuthority: string;
    mint: string;
    data: {
      name: string;
      symbol: string;
      uri: string;
      sellerFeeBasisPoints: number;
      creators: Creator[];
    };
    primarySaleHappened: number;
    isMutable: number;
  };
  name: string;
  uri: string;
  imageUri: string;
};

export type MetadataCacheContent = {
  [key: string]: TokenMeta;
};

export type ArweaveLinks = {
  [index: string]: {
    link: string;
    name: string;
    imageUri?: string;
  };
};

export type MetaplexCacheJson = {
  program: unknown;
  items: ArweaveLinks;
};

export function loadWalletKey(keypair: any): Keypair {
  if (!keypair || keypair == '') {
    throw new Error('Keypair is required!');
  }
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString())),
  );

  return loaded;
}

export const getUnixTs = () => {
  return new Date().getTime() / 1000;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_TIMEOUT = 15000;

interface BlockhashAndFeeCalculator {
  blockhash: Blockhash;
  feeCalculator: FeeCalculator;
}

export function createAssociatedTokenAccountInstruction(
  associatedTokenAddress: PublicKey,
  payer: PublicKey,
  walletAddress: PublicKey,
  splTokenMintAddress: PublicKey,
) {
  const keys = [
    {
      pubkey: payer,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: walletAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splTokenMintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

const PubKeysInternedMap = new Map<string, PublicKey>();
export const toPublicKey = (key: string | PublicKey) => {
  if (typeof key !== 'string') {
    return key;
  }

  let result = PubKeysInternedMap.get(key);
  if (!result) {
    result = new PublicKey(key);
    PubKeysInternedMap.set(key, result);
  }

  return result;
};

export async function getAssocTokenAddress(
  tokenAddress: string | PublicKey,
  wallet: string | PublicKey,
) {
  return await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    toPublicKey(tokenAddress),
    toPublicKey(wallet),
  );
}

export async function getTokenBalance(
  connection: Connection,
  pubkey: PublicKey,
) {
  return parseInt(
    (await connection.getTokenAccountBalance(pubkey)).value.amount,
  );
}
