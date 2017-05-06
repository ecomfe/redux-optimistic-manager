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
let transaction = createOptimisticManager(store);

let delay = time => new Promise(resolve => setTimeout(resolve, time));

let main = async () => {
    let slow = async () => {
        let {postAction, postOptimisticAction, rollback} = transaction(dispatch);

        let firstActual = {type: 'PUSH', value: 'slow actual 1'};
        postAction(firstActual);
        dispatch(firstActual);

        let secondActual = {type: 'PUSH', value: 'slow actual 2'};
        postAction(secondActual);
        dispatch(secondActual);

        let firstOptimistic = {type: 'PUSH', value: 'slow optimi 1'};
        postOptimisticAction(firstOptimistic);
        dispatch(firstOptimistic);

        let secondOptimistic = {type: 'PUSH', value: 'slow optimi 2'};
        postOptimisticAction(secondOptimistic);
        dispatch(secondOptimistic);

        await delay(500);

        rollback();

        let thirdActual = {type: 'PUSH', value: 'slow actual 3'};
        postAction(thirdActual);
        dispatch(thirdActual);

        let fourthActual = {type: 'PUSH', value: 'slow actual 4'};
        postAction(fourthActual);
        dispatch(fourthActual);
    };

    let fast = async () => {
        let {postAction, postOptimisticAction, rollback} = transaction(dispatch);

        let firstActual = {type: 'PUSH', value: 'fast actual 1'};
        postAction(firstActual);
        dispatch(firstActual);

        let secondActual = {type: 'PUSH', value: 'fast actual 2'};
        postAction(secondActual);
        dispatch(secondActual);

        let firstOptimistic = {type: 'PUSH', value: 'fast optimi 1'};
        postOptimisticAction(firstOptimistic);
        dispatch(firstOptimistic);

        let secondOptimistic = {type: 'PUSH', value: 'fast optimi 2'};
        postOptimisticAction(secondOptimistic);
        dispatch(secondOptimistic);

        await delay(200);

        rollback();

        let thirdActual = {type: 'PUSH', value: 'fast actual 3'};
        postAction(thirdActual);
        dispatch(thirdActual);

        let fourthActual = {type: 'PUSH', value: 'fast actual 4'};
        postAction(fourthActual);
        dispatch(fourthActual);
    };

    slow();
    fast();
};

main();
