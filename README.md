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

2. Wrap your reducer with `createOptimisticReducer` higher order function, then create a manager for your store, the `createOptimisticManager` returns a `transaction` function:

    ```javascript
    // store.js
    import {createStore} from 'redux';
    import {createOptimisticManager, createOptimisticReducer} from 'redux-manager';
    import reducer from './reducer';

    export let store = createStore(createOptimisticReducer(reducer));
    export let transaction = createOptimisticManager(store);
    ```

3. Begin a transaction before your business logic, a transaction simply gives you 4 functions:

    ```javascript
    import {transaction} from './store';

    let {postAction, postOptimisticAction, postExternalAction, rollback} = transaction();
    ```

    - `postAction(action)` tells transaction to save a simple action.
    - `postOptimisticAction(action)` tells transaction to save a optimistic action which should be dismissed back when this transaction rolls back.
    - `postExternalAction(action)` is to save an action which does not belong to this transaction, this is designed for 3rd-party middlewares.
    - `rollback()` is to rollback all optimistic actions in this transaction.

4. Before you dispatch any action, call `postAction` or `postOptimisticAction` to save it in transaction, you can rollback optimistic ones by calling `rollback()`:

    ```javascript
    let newTodo = todo => ({type: 'NEW_TODO', payload: todo});

    let notify = message => ({type: 'NOTIFY', payload: message});

    let saveTodo = async todo => {
        // Begin a transaction
        let {postAction, postOptimisticAction, rollback} = transaction();

        // Actual action will be saved and re-dispatched on rollback
        let notifyAction = notify('Saving todo');
        postAction(notify);
        dispatch(notify);

        let newTodoAction = newTodo(todo);
        // Save and dispatch an optimistic action, this action will be dismissed on rollback
        postOptimisticAction(newTodoAction);
        dispatch(newTodoAction);

        let createdTodo = await service.post('/todos', todo);

        // Rollback to dismiss all optimistic actions
        rollback();

        // Dispatch final actual action, this should also be saved
        let finalAction = newTodo(createdTodo0;
        postAction(finalAction);
        dispatch(finalAction);
    };
    ```

## Integrate with middleware

[redux-optimistic-thunk](https://github.com/ecomfe/redux-optimistic-thunk) is an optimistic middleware based on this lib, [the code](https://github.com/ecomfe/redux-optimistic-thunk/blob/master/src/index.js) is quite easy to read.
