# redux-optimistic-manager
[![building status](https://img.shields.io/travis/ecomfe/redux-optimistic-manager.svg?style=flat)](https://travis-ci.org/ecomfe/redux-optimistic-manager)
[![Coverage Status](https://img.shields.io/coveralls/ecomfe/redux-optimistic-manager.svg?style=flat)](https://coveralls.io/github/ecomfe/redux-optimistic-manager)
[![NPM version](https://img.shields.io/npm/v/redux-optimistic-manager.svg?style=flat)](https://www.npmjs.com/package/redux-optimistic-manager)

redux-optimistic-manager is a lib aimed to simplify optimistic UI implement in redux environment. this lib uses a transaction based method to handle actual and optimistic actions, rolling back optimistic ones in a future point.

## How to use

Using redux-optimistic-manager is simple.

1. Install it:

    ```shell
    npm install --save redux-optimistic-manager
    ```

2. Wrap your reducer with `createOptimisticReducer` higher order function, then create a manager for your store, the `createOptimisticManager` returns `postAction` and `rollback` function:

    ```javascript
    // store.js
    import {createStore} from 'redux';
    import {createOptimisticManager, createOptimisticReducer} from 'redux-manager';
    import reducer from './reducer';

    export let store = createStore(createOptimisticReducer(reducer));
    export let {postAction, rollback} = createOptimisticManager(store);
    ```

    - `postAction(action, [transactionId])` tells transaction to save a action, if `transactionId` is provided then the action is treated as optimistic, `transactionId` can be any unique value except `null` and `undefined`, we recommend using an new object(`{}`) as transaction id. The `postAction` function returns whatever you provide as `action` argument.
    - `rollback(transactionId, [replay = store.dispatch])` is to rollback all optimistic actions in certain transaction, you can provide an extra `replay` function to `rollback`, all saved actions will be dispatch through `replay` function.

4. Create a `transactionId` in your business logic, before you dispatch any action, call `postAction` to save it in transaction, you can rollback optimistic ones by calling `rollback(transactionId)`:

    ```javascript
    let newTodo = todo => ({type: 'NEW_TODO', payload: todo});

    let notify = message => ({type: 'NOTIFY', payload: message});

    let saveTodo = async todo => {
        // Begin a transaction
        let transactionId = {};

        // Actual action will be saved and re-dispatched on rollback
        postAction(postAction(notify('Saving todo')));

        let newTodoAction = newTodo(todo);
        // Save and dispatch an optimistic action, this action will be dismissed on rollback
        dispatch(postAction(newTodo(todo)), transactionId);

        let createdTodo = await service.post('/todos', todo);

        // Rollback to dismiss all optimistic actions
        rollback(transactionId);

        // Dispatch final actual action, this should also be saved
        dispatch(postAction(newTodo(createdTodo)));
    };
    ```

## Integrate with middleware

[redux-optimistic-thunk](https://github.com/ecomfe/redux-optimistic-thunk) is an optimistic middleware based on this lib, [the code](https://github.com/ecomfe/redux-optimistic-thunk/blob/master/src/index.js) is quite easy to read.

## Change Log

### 2.0.0

- Simplified interfaces, now we need only `postAction` and `rollback` functions.
- No longer manage transaction id, you should provide an unique `transactionId` to `postAction` and `rollback` function.

### 3.0.0

- Refreshed build with single rollup.
- The es module version is now located at `dist/index.mjs`.
- Add `"sideEffects": false` to `package.json`.
