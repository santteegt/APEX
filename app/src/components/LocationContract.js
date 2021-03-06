// Imports - React
import React, { Component } from 'react';
// Imports - Redux
import { connect } from 'react-redux';
import { Field, reduxForm } from 'redux-form';
// Imports - Frameworks (Semantic-UI and Material-UI)
import { Message } from "semantic-ui-react";
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import FormControl from "@material-ui/core/FormControl/FormControl";
import InputLabel from "@material-ui/core/InputLabel/InputLabel";
import Select from "@material-ui/core/Select/Select";
import TextField from "@material-ui/core/TextField/TextField";
// Imports - Components
import Notifier, {openSnackbar} from "./Notifier";
// Imports - Reducers (Redux)
import { computeClusters } from "../actions";
// Imports - enigma-js client library utility packages
import { utils, eeConstants } from 'enigma-js';
import GoogleMapReact from 'google-map-react';
import * as assert from 'assert';
const Point = ({ text }) => <div>{text}</div>;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class LocationContract extends Component {
    constructor(props) {
        super(props);
        this.onAddLocation = this.onAddLocation.bind(this);
        this.oncomputeClusters = this.oncomputeClusters.bind(this);
    }

    // Redux form/material-ui render net worth text field component
    static renderLocationInput({label, input, meta: { touched, invalid, error }, ...custom }) {
        return (
            <TextField
                label={label}
                type="text"
                multiline
                rows="10"
                placeholder={label}
                 error={touched && invalid}
                helperText={touched && error}
                {...input}
                {...custom}
                fullWidth
            />
        )
    }

    // Redux form/material-ui render net worth text field component
    static renderNumericInput({label, input, meta: { touched, invalid, error }, ...custom }) {
        return (
            <TextField
                label={label}
                type="number"
                placeholder={label}
                 error={touched && invalid}
                helperText={touched && error}
                {...input}
                {...custom}
                fullWidth
            />
        )
    }

    // Redux form callback when add location info is submitted
    async onAddLocation({ locationstring } ) {
        // Sanitise input - check for valid JSON of latitudes / longitudes.
        try {
            var locations = JSON.parse(locationstring);
            assert(Array.isArray(locations));
            for (var i = 0; i < locations.length; i++) {
                var keys = Object.keys(locations[i]);
                assert(keys.length === 2);
                assert(keys[0] === "latitude");
                assert(keys[1] === "longitude");
                assert(typeof locations[i].latitude === "number" && Math.abs(locations[i].latitude) < 90.0);
                assert(typeof locations[i].longitude === "number" && Math.abs(locations[i].longitude) < 180.0);
            }
        } catch {
            openSnackbar({ message: 'Invalid input: must be array of JSON latitude/longitude points' });
            return
        }
        // Create compute task metadata
        // computeTask(
        //      fn - the signature of the function we are calling (Solidity-types, no spaces)
        //      args - the args passed into our method w/ format [[arg_1, type_1], [arg_2, type_2], …, [arg_n, type_n]]
        //      gasLimit - ENG gas units to be used for the computation task
        //      gasPx - ENG gas price to be used for the computation task in grains format (10⁸)
        //      sender - Ethereum address deploying the contract
        //      scAddr - the secret contract address for which this computation task belongs to
        // )
        const taskFn = 'add_location(string)';
        // Multiply by 1M as contracts only take ints
        const taskArgs = [[locationstring, 'string']];
        const taskGasLimit = 10000000;
        const taskGasPx = utils.toGrains(1e-7);
        let task = await new Promise((resolve, reject) => {
            this.props.enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, this.props.accounts[0],
                this.props.deployedLocationContract)
                .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
                .on(eeConstants.ERROR, (error) => {
                    if (error.hasOwnProperty('message')){
                        openSnackbar({ message: error.message});
                    } else {
                        openSnackbar({ message: 'Failed to add location'});
                    }
                    reject(error);
                });
        });
        openSnackbar({ message: 'Task pending: adding location' });
        while (task.ethStatus === 1) {
            // Poll for task record status and finality on Ethereum after worker has finished computation
            task = await this.props.enigma.getTaskRecordStatus(task);
            await sleep(1000);
        }
        // ethStatus === 2 means task has successfully been computed and committed on Ethereum
        task.ethStatus === 2 ?
            openSnackbar({ message: 'Task succeeded: added location' })
            :
            openSnackbar({ message: 'Task failed: did not add location' })
        ;
        this.props.reset('addLocation');
    }

    // Callback when compute clusters button is clicked
    async oncomputeClusters({ numclusters }) {
        // Create compute task metadata
        const taskFn = 'cluster(int32)';
        const taskArgs = [[numclusters, 'int32']];
        const taskGasLimit = 10000000;
        const taskGasPx = utils.toGrains(1e-7);
        let task = await new Promise((resolve, reject) => {
            this.props.enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, this.props.accounts[0],
                this.props.deployedLocationContract)
                .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
                .on(eeConstants.ERROR, (error) => {
                    if (error.hasOwnProperty('message')){
                        openSnackbar({ message: error.message});
                    } else {
                        openSnackbar({ message: 'Failed to compute clusters'});
                    }
                    reject(error);
                });
        });
        openSnackbar({ message: 'Task pending: computing clusters' });
        while (task.ethStatus === 1) {
            task = await this.props.enigma.getTaskRecordStatus(task);
            await sleep(1000);
        }
        if (task.ethStatus === 2) {
            openSnackbar({ message: 'Task succeeded: computed clusters' });
            // Get task result by passing in existing task - obtains the encrypted, abi-encoded output
            task = await new Promise((resolve, reject) => {
                this.props.enigma.getTaskResult(task)
                    .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
                    .on(eeConstants.ERROR, (error) => reject(error));
            });
            // Decrypt the task result - obtains the decrypted, abi-encoded output
            task = await this.props.enigma.decryptTaskResult(task);
            // Abi-decode the output to its desired components
            const clustersAddress = this.props.enigma.web3.eth.abi.decodeParameters([{
                type: 'string',
                name: 'clusters',
            }], task.decryptedOutput).clusters;
            this.props.computeClusters(clustersAddress);
        } else {
            openSnackbar({ message: 'Task failed: did not compute clusters' });
        }
    }

    render() {
        if (this.props.deployedLocationContract === null) {
            return (
                <div>
                    <Message color="blue">Classification contract not yet deployed...</Message>
                </div>
            )
        }
        var points = [];
        for (var i = 0; i < this.props.clusters.length; i++) {
            points.push(<Point
                lat={this.props.clusters[i][0]}
                lng={this.props.clusters[i][1]}
                text="X"
            />);
        }
        return (
            <div>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <h3>Secret Contract Address: {this.props.deployedLocationContract}</h3>
                    </Grid>
                    <Grid item xs={12}>
                        <div>
                            <Notifier />
                            <h4>Enter Customer Location Data</h4>
                            <form>
                                <div>
                                    <Field
                                        name="locationstring"
                                        component={LocationContract.renderLocationInput}
                                        label="Location JSON array"
                                    />
                                </div>
                                <br />
                                <div>
                                    <Button
                                        onClick={this.props.handleSubmit(this.onAddLocation)}
                                        variant='outlined'
                                        color='primary'>
                                        Submit
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Grid>
                    <Grid item></Grid>
                </Grid>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <div>
                            <h4>Cluster Telco Users</h4>
                            <div>
                                <div style={{ height: '70em', width: '100%' }}>
                                    <GoogleMapReact
                                    bootstrapURLKeys={{ key: process.env.REACT_APP_API_KEY }}
                                    defaultCenter={{ lat: 51.507221, lng: -0.127600}}
                                    defaultZoom={11}
                                    options={{
                                        disableDefaultUI: true,
                                        styles: [
                                            {
                                              "featureType": "all",
                                              "elementType": "labels",
                                              "stylers": [
                                                {
                                                  "visibility": "on"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "all",
                                              "elementType": "labels.text.fill",
                                              "stylers": [
                                                {
                                                  "saturation": 36
                                                },
                                                {
                                                  "color": "#000000"
                                                },
                                                {
                                                  "lightness": 40
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "all",
                                              "elementType": "labels.text.stroke",
                                              "stylers": [
                                                {
                                                  "visibility": "on"
                                                },
                                                {
                                                  "color": "#000000"
                                                },
                                                {
                                                  "lightness": 16
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "all",
                                              "elementType": "labels.icon",
                                              "stylers": [
                                                {
                                                  "visibility": "off"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "administrative",
                                              "elementType": "geometry.fill",
                                              "stylers": [
                                                {
                                                  "color": "#000000"
                                                },
                                                {
                                                  "lightness": 20
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "administrative",
                                              "elementType": "geometry.stroke",
                                              "stylers": [
                                                {
                                                  "color": "#000000"
                                                },
                                                {
                                                  "lightness": 17
                                                },
                                                {
                                                  "weight": 1.2
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "administrative.country",
                                              "elementType": "labels.text.fill",
                                              "stylers": [
                                                {
                                                  "color": "#838383"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "administrative.locality",
                                              "elementType": "labels.text.fill",
                                              "stylers": [
                                                {
                                                  "color": "#c4c4c4"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "administrative.neighborhood",
                                              "elementType": "labels.text.fill",
                                              "stylers": [
                                                {
                                                  "color": "#aaaaaa"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "landscape",
                                              "elementType": "geometry",
                                              "stylers": [
                                                {
                                                  "color": "#151516"
                                                },
                                                {
                                                  "lightness": "0"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "poi",
                                              "elementType": "geometry",
                                              "stylers": [
                                                {
                                                  "color": "#000000"
                                                },
                                                {
                                                  "lightness": 21
                                                },
                                                {
                                                  "visibility": "on"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "poi",
                                              "elementType": "labels",
                                              "stylers": [
                                                {
                                                  "visibility": "off"
                                                },
                                                {
                                                  "hue": "#ff0000"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "poi",
                                              "elementType": "labels.icon",
                                              "stylers": [
                                                {
                                                  "saturation": "-100"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "poi.business",
                                              "elementType": "geometry",
                                              "stylers": [
                                                {
                                                  "visibility": "on"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "road.highway",
                                              "elementType": "geometry.fill",
                                              "stylers": [
                                                {
                                                  "color": "#6e6e6e"
                                                },
                                                {
                                                  "lightness": "0"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "road.highway",
                                              "elementType": "geometry.stroke",
                                              "stylers": [
                                                {
                                                  "visibility": "off"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "road.arterial",
                                              "elementType": "geometry",
                                              "stylers": [
                                                {
                                                  "color": "#000000"
                                                },
                                                {
                                                  "lightness": 18
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "road.arterial",
                                              "elementType": "geometry.fill",
                                              "stylers": [
                                                {
                                                  "color": "#575757"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "road.arterial",
                                              "elementType": "labels.text.fill",
                                              "stylers": [
                                                {
                                                  "color": "#c3c3c3"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "road.arterial",
                                              "elementType": "labels.text.stroke",
                                              "stylers": [
                                                {
                                                  "color": "#2c2c2c"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "road.local",
                                              "elementType": "geometry",
                                              "stylers": [
                                                {
                                                  "color": "#000000"
                                                },
                                                {
                                                  "lightness": 16
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "road.local",
                                              "elementType": "labels.text.fill",
                                              "stylers": [
                                                {
                                                  "color": "#5f5f5f"
                                                },
                                                {
                                                  "visibility": "on"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "road.local",
                                              "elementType": "labels.text.stroke",
                                              "stylers": [
                                                {
                                                  "visibility": "off"
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "transit",
                                              "elementType": "geometry",
                                              "stylers": [
                                                {
                                                  "color": "#717171"
                                                },
                                                {
                                                  "lightness": 19
                                                }
                                              ]
                                            },
                                            {
                                              "featureType": "water",
                                              "elementType": "geometry",
                                              "stylers": [
                                                {
                                                  "color": "#000000"
                                                },
                                                {
                                                  "lightness": 17
                                                }
                                              ]
                                            }
                                          ]
                                    }}
                                    >
                                        {points}
                                    </GoogleMapReact>
                                </div>
                                <form>
                                    <div>
                                        <Field
                                            name="numclusters"
                                            component={LocationContract.renderNumericInput}
                                            label="Number of clusters"
                                        />
                                    </div>
                                    <br />
                                    <div>
                                        <Button
                                            onClick={this.props.handleSubmit(this.oncomputeClusters)}
                                            variant='outlined'
                                            color='primary'>
                                            Submit
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </Grid>
                    <Grid item></Grid>
                </Grid>
            </div>
        )
    }
}
const mapStateToProps = (state) => {
    return {
        enigma: state.enigma,
        accounts: state.accounts,
        deployedLocationContract: state.deployedLocationContract,
        clusters: state.clusters !== null ? JSON.parse(state.clusters.replace(/\(/g,'[').replace(/\)/g,']')) : [],
    }
};
export default connect(mapStateToProps, { computeClusters })(reduxForm({
    form: 'addLocation',
})(LocationContract));
