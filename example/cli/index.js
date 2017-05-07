/**
 * redux-optimistic-manager
 *
 * @file cli example
 * @author otakustay
 */

/* eslint-disable no-console */

import {createStore, applyMiddleware} from 'redux';
import {createOptimisticManager, createOptimisticReducer} from '../../src/index';
import chalk from 'chalk';

let reducer = (state, action) => (action.type === 'PUSH' ? {...state, items: state.items.concat(action.value)} : state);

let logger = ({getState}) => next => action => {
    if (action.type !== 'PUSH' && !action.type.startsWith('@@redux-optimistic-thunk')) {
        return next(action);
    }

    let returnValue = next(action);

    let {optimistic, items} = getState();
    let prints = items.map(value => (value.includes('optimi') ? chalk.gray(value) : chalk.cyan(value)));
    let prefix = optimistic ? '(optimistic)' : '    (actual)';
    console.log(prefix + ' ' + prints.join(' -> '));

    return returnValue;
};

let store = createStore(
    createOptimisticReducer(reducer),
    {items: []},
    applyMiddleware(logger)
);
let dispatch = store.dispatch;
let {postAction, rollback} = createOptimisticManager(store);

let delay = time => new Promise(resolve => setTimeout(resolve, time));

let main = async () => {
    let slow = async () => {
        let transactionId = {};

        dispatch(postAction({type: 'PUSH', value: 'slow actual 1'}));

        dispatch(postAction({type: 'PUSH', value: 'slow actual 2'}));

        dispatch(postAction({type: 'PUSH', value: 'slow optimi 1'}, transactionId));

        dispatch(postAction({type: 'PUSH', value: 'slow optimi 2'}, transactionId));

        await delay(500);

        rollback(transactionId, dispatch);

        dispatch(postAction({type: 'PUSH', value: 'slow actual 3'}));

        dispatch(postAction({type: 'PUSH', value: 'slow actual 4'}));
    };

    let fast = async () => {
        let transactionId = {};

        dispatch(postAction({type: 'PUSH', value: 'fast actual 1'}));

        dispatch(postAction({type: 'PUSH', value: 'fast actual 2'}));

        dispatch(postAction({type: 'PUSH', value: 'fast optimi 1'}, transactionId));

        dispatch(postAction({type: 'PUSH', value: 'fast optimi 2'}, transactionId));

        await delay(200);

        rollback(transactionId, dispatch);

        dispatch(postAction({type: 'PUSH', value: 'fast actual 3'}));

        dispatch(postAction({type: 'PUSH', value: 'fast actual 4'}));
    };

    slow();
    fast();
};

main();
