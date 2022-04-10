# How to mint the NFT
## deploy the program
### build
```
anchor build
```
### deploy
```
anchor deploy
```
### initialize the program
```
yarn install
anchor migrate
```

## mint the script
```
ts-node ./script/nft.ts mint -e devnet --keypair <path of the keypair>
```