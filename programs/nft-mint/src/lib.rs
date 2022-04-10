use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::{
        invoke_signed, invoke,
    },
    sysvar::{
        rent::Rent
    },
};

use anchor_spl::{
    token::{self, Mint, Token, TokenAccount},
};
use mpl_token_metadata::{
    instruction::{
        create_metadata_accounts, create_master_edition,
        update_metadata_accounts,
    },
    state::{
        Creator,
    },
};

pub mod constants {
    pub const NFT_MINT_PDA_SEED: &[u8] = b"mint";
    pub const NFT_SELLER_FEE_BASIS_POINTS: u16 = 500;
}

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod nft_mint {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        _config_nonce: u8,
        update_authority: Pubkey,
    ) -> ProgramResult {
        msg!("Initializing configuration.");
        let config = &mut ctx.accounts.configuration;
        config.owner = ctx.accounts.signer.key();
        config.nft_count = 0;
        config.update_authority = update_authority;
        msg!("Done");
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        _config_nonce: u8,
        update_authority: Pubkey,
    ) -> ProgramResult {
        msg!("Updating configuration.");
        let config = &mut ctx.accounts.configuration;
        config.owner = ctx.accounts.signer.key();
        config.update_authority = update_authority;
        msg!("Done");
        Ok(())
    }

    pub fn minting_nft(
        ctx: Context<MintingNFT>,
        _nonce_config: u8,
        name: String,
        symbol: String,
        uri: String
    ) -> ProgramResult {
        msg!("Start minting NFT.");

        let seeds = &[
            constants::NFT_MINT_PDA_SEED.as_ref(),
            &[_nonce_config],
        ];
        let pda_signer = &[&seeds[..]];

        msg!("Step1: Creating metadata account");
        //Derive metadata account
        let metaplex_program_id = mpl_token_metadata::ID;
        let metadata_seeds = &[
            "metadata".as_bytes(),
            metaplex_program_id.as_ref(),
            ctx.accounts.mint.key.as_ref(),
        ];

        let (metadata_account, _pda) =
            Pubkey::find_program_address(metadata_seeds, &metaplex_program_id);
        let creators = vec![
            Creator {
                address: ctx.accounts.configuration.to_account_info().key(),
                verified: true,
                share: 0,
            },
            Creator {
                address: ctx.accounts.signer.to_account_info().key(),
                verified: false,
                share: 100,
            }
        ];

        let create_metadata_account_ix = create_metadata_accounts(
            metaplex_program_id,
            metadata_account,
            *ctx.accounts.mint.key,
            ctx.accounts.signer.to_account_info().key(),
            ctx.accounts.signer.to_account_info().key(),
            ctx.accounts.configuration.to_account_info().key(),
            name,
            symbol,
            uri,
            Some(creators),
            constants::NFT_SELLER_FEE_BASIS_POINTS,
            true,
            true
        );

        invoke_signed(
            &create_metadata_account_ix,
            &[
                ctx.accounts.metadata.clone(),
                ctx.accounts.mint.clone(),
                ctx.accounts.signer.to_account_info().clone(),
                ctx.accounts.configuration.to_account_info().clone(),
                ctx.accounts.token_metadata_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
            pda_signer,
        )?;

        msg!("Step2: Creating master edition");
        // Derive Master Edition account
        let master_edition_seeds = &[
            "metadata".as_bytes(),
            metaplex_program_id.as_ref(),
            ctx.accounts.mint.key.as_ref(),
            "edition".as_bytes(),
        ];
        let (master_edition_account, _pda) =
            Pubkey::find_program_address(master_edition_seeds, &metaplex_program_id);

        let create_master_edition_account_ix = create_master_edition(
            metaplex_program_id,
            master_edition_account,
            *ctx.accounts.mint.key,
            ctx.accounts.configuration.to_account_info().key(),
            ctx.accounts.signer.to_account_info().key(),
            metadata_account,
            ctx.accounts.signer.to_account_info().key(),
            Some(0),
        );

        invoke_signed(
            &create_master_edition_account_ix,
            &[
                ctx.accounts.masteredition.clone(),
                ctx.accounts.metadata.clone(),
                ctx.accounts.mint.clone(),
                ctx.accounts.signer.to_account_info().clone(),
                ctx.accounts.configuration.to_account_info().clone(),
                ctx.accounts.token_metadata_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
            pda_signer,
        )?;

        msg!("Step3: Updating primary sales");
        let new_update_authority = Some(ctx.accounts.configuration.update_authority);
        invoke_signed(
            &update_metadata_accounts(
                metaplex_program_id,
                metadata_account,
                ctx.accounts.configuration.to_account_info().key(),
                new_update_authority,
                None,
                Some(true),
            ),
            &[
                ctx.accounts.token_metadata_program.to_account_info(),
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.signer.to_account_info(),
                ctx.accounts.configuration.to_account_info().clone(),
            ],
            pda_signer,
        )?;

        ctx.accounts.configuration.nft_count += 1;

        msg!("Done");
        // emit!(MintEvent {
        //     mint: ctx.accounts.mint.key.to_string(),
        //     recipient: ctx.accounts.recipient.key.to_string(),
        //     nft_count: ctx.accounts.configuration.nft_count.to_string(),
        //     status: "ok".to_string(),
        // });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
    init, payer = signer,
    space = 8 + Configuration::LEN,
    seeds = [constants::NFT_MINT_PDA_SEED.as_ref()],
    bump,
    )]
    pub configuration: Box<Account<'info, Configuration>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(_config_nonce: u8)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
    mut,
    seeds = [constants::NFT_MINT_PDA_SEED.as_ref()],
    bump,
    constraint = configuration.owner == signer.key() @ErrorCode::PermissionError,
    )]
    pub configuration: Box<Account<'info, Configuration>>,
}

#[derive(Accounts)]
pub struct MintingNFT<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
    mut,
    seeds = [constants::NFT_MINT_PDA_SEED.as_ref()],
    bump,
    constraint = configuration.owner == signer.key() @ErrorCode::PermissionError,
    )]
    pub configuration: Box<Account<'info, Configuration>>,

    #[account(mut, signer)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub mint: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub metadata: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub masteredition: AccountInfo<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_metadata_program: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
#[derive(Default)]
pub struct Configuration {
    pub owner: Pubkey,
    pub update_authority: Pubkey,
}

impl Configuration {
    pub const LEN: usize = 32 + 32;
}

#[error]
pub enum ErrorCode {
    #[msg("Invalid permission")]
    PermissionError,
}