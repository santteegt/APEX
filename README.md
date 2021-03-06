![APEX](./docs/ca_logo.png)

Collaborative industry analytics using Enigma private compute. Enigma allows all participants to share in industry-wide analytics without revealing any information regarding their own operations.

Check out the [demo video](https://www.youtube.com/watch?v=mrdCvnSCE7Q).

Features:

- Clustering on collaborative lat/long location data (K-Means).
- Classification of collaborative lat/long location data with training data supplied for each function call by each party privately (Gaussian Naive Bayes).
- Collaborative training for a classifier which may then be applied to collaborative lat/long data (Gaussian Naive Bayes).
- Data input serialisation/deserialisation and sanitation (JSON point list input).
- UI for data input and drawing of outputs on a Google Map.

## Requirements

- Linux with Docker.

## Install

```sh
./scripts/install.sh
```

## Deploy contracts

```sh
discovery start
discovery compile
disvovery migrate
discovery test
```

## Start the DApp

You will need a [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key). Set it in `app/.env`, then start the dApp:

```sh
cd app
npm start
```

By defualt, the dApp uses the HTTP Web3 provider to connect to a local Ganache network configured in truffle.js. To use MetaMask, set the Web3 provider to do so and **change the address field from a dropdown to a text field.**

Test: `npm test`
Build: `npm run build`
For more details, see the [Enigma React template](https://github.com/enigmampc/discovery-template-dapp).

## Debugging

If you're unable to connect to Docker when running discovery start, add yourself to the docker group (below) then log out and log back in:

```sh
sudo usermod -aG docker $USER
```

If you're getting a file/directory does not exist error on `discovery compile`, it's likely you've run `discovery start` in a different directory. Just run `discovery start` in this directory.

If you're getting an `unable to resolve EnigmaSimulation.json` error, the symlink at `app/src/build` is not working. Create a new symlink there to the top-level `build` directory, or alternatively make an `app/src/build` folder and copy the contents of the top-level `build` folder to it.
