/* eslint-env mocha */
/* eslint-disable no-empty-function */
import {expect} from 'chai';
import sinon from 'sinon';
import {createOptimisticManager, createOptimisticReducer} from '../src/index';

const createStore = () => {
    const actions = [];
    let state = {};

    return {
        actions: actions,

        getState() {
            return state;
        },

        setState(nextState) {
            state = nextState;
        },

        dispatch(action) {
            actions.push(action);
        },
    };
};

describe('createOptimisticManager', () => {
    it('should be a function', () => {
        expect(typeof createOptimisticManager).to.equal('function');
    });

    it('should return postAction and rollback function', () => {
        const store = createStore();
        const {postAction, rollback} = createOptimisticManager(store);
        expect(typeof postAction).to.equal('function');
        expect(typeof rollback).to.equal('function');
    });

    it('should return the input action for postAction function', () => {
        const store = createStore();
        const postAction = createOptimisticManager(store).postAction;
        const action = {};
        expect(postAction(action)).to.equal(action);
        const thunk = () => {};
        expect(postAction(thunk)).to.equal(thunk);
    });

    it('should throw when no transactionId is provided to rollback function', () => {
        const store = createStore();
        const rollback = createOptimisticManager(store).rollback;
        expect(rollback).to.throw();
    });

    it('should set state to the one before the first optimistic action when rollback', () => {
        const store = createStore();
        const transactionId = 1;
        const {postAction, rollback} = createOptimisticManager(store);
        store.setState(0);
        postAction({});
        store.setState(1);
        postAction({}, transactionId);
        store.setState(2);
        rollback(transactionId, store.dispatch);
        expect(store.actions.find(item => item.type === '@@optimistic/ROLLBACK').payload).to.equal(1);
    });

    it('should replay non-optimistic actions after rollback', () => {
        const store = createStore();
        const transactionId = 1;
        const replay = sinon.spy();
        const {postAction, rollback} = createOptimisticManager(store);
        const optimisticAction = {};
        const actualAction = {};
        postAction(optimisticAction, transactionId);
        postAction(actualAction);
        rollback(transactionId, replay);
        expect(replay.called).to.equal(true);
        expect(replay.firstCall.args[0]).to.equal(actualAction);
    });

    it('should replay optimistic actions in other transactions after rollback', () => {
        const store = createStore();
        const replay = sinon.spy();
        const {postAction, rollback} = createOptimisticManager(store);
        const firstAction = {};
        const secondAction = {};
        const thirdAction = {};
        postAction(firstAction, 1);
        postAction(secondAction, 2);
        postAction(thirdAction, 3);
        rollback(2, replay);
        expect(replay.called).to.equal(true);
        expect(replay.firstCall.args[0]).to.equal(firstAction);
        expect(replay.secondCall.args[0]).to.equal(thirdAction);
    });

    it('should not replay any action if no optimistic action dispatched', () => {
        const store = createStore();
        const replay = sinon.spy();
        const {postAction, rollback} = createOptimisticManager(store);
        postAction({});
        rollback(1, replay);
        expect(replay.called).to.equal(false);
    });

    it('should not replay non-plain actions', () => {
        const store = createStore();
        const replay = sinon.spy();
        const {postAction, rollback} = createOptimisticManager(store);
        postAction(1);
        postAction(() => {});
        postAction([]);
        rollback(1, replay);
        expect(replay.called).to.equal(false);
    });

    it('should use dispatch as default replay function', () => {
        const store = createStore();
        sinon.spy(store, 'dispatch');
        const transactionId = 1;
        const {postAction, rollback} = createOptimisticManager(store);
        const optimisticAction = {};
        const actualAction = {};
        postAction(optimisticAction, transactionId);
        postAction(actualAction);
        rollback(transactionId);
        expect(store.dispatch.called).to.equal(true);
        expect(store.dispatch.lastCall.args[0]).to.equal(actualAction);
    });

    it('should mark state as optimistic when the first optimistic action arrives', () => {
        const store = createStore();
        const postAction = createOptimisticManager(store).postAction;
        postAction({}, 1);
        expect(store.actions.some(item => item.type === '@@optimistic/MARK')).to.not.equal(false);
    });

    it('should not dispatch mark action if state is already optimistic', () => {
        const store = createStore();
        const postAction = createOptimisticManager(store).postAction;
        store.setState({optimistic: true});
        postAction({}, 1);
        expect(store.actions.some(item => item.type === '@@optimistic/MARK')).to.equal(false);
    });
});

describe('createOptimisticReducer', () => {
    it('should be a function', () => {
        expect(typeof createOptimisticReducer).to.equal('function');
    });

    it('should wrap a reducer', () => {
        expect(typeof createOptimisticReducer(() => {})).to.equal('function');
    });

    it('should initialize optimistic property of state to false', () => {
        const reducer = createOptimisticReducer(n => n);
        const value = reducer({}, {type: 'any'});
        expect(value).to.deep.equal({optimistic: false});
    });

    it('should produce rollback state for @@optimistic/ROLLBACK action', () => {
        const state = {optimistic: false, x: 1};
        const reducer = createOptimisticReducer(n => n);
        const value = reducer({optimistic: false}, {type: '@@optimistic/ROLLBACK', payload: state});
        expect(value).to.equal(state);
    });

    it('should mark state as optimistic in @@optimistic/MARK action', () => {
        const state = {optimistic: false, x: 1};
        const reducer = createOptimisticReducer(n => n);
        const value = reducer(state, {type: '@@optimistic/MARK'});
        expect(value).to.deep.equal({x: 1, optimistic: true});
    });

    it('should return input state if state is already optimistic in @@optimistic/MARK action', () => {
        const state = {optimistic: true, x: 1};
        const reducer = createOptimisticReducer(n => n);
        const value = reducer(state, {type: '@@optimistic/MARK'});
        expect(value).to.equal(state);
    });

    it('should call next reducer for unknown action type with optimistic mark removed', () => {
        const nextReducer = sinon.spy();
        const state = {optimistic: false};
        const action = {type: 'any'};
        const reducer = createOptimisticReducer(nextReducer);
        reducer(state, action);
        expect(nextReducer.called).to.equal(true);
        expect(nextReducer.firstCall.args[0]).to.deep.equal({});
        expect(nextReducer.firstCall.args[1]).to.equal(action);
    });

    it('should call next reducer with identical input state when no optimistic mark', () => {
        const nextReducer = sinon.spy();
        const state = {x: 1};
        const action = {type: 'any'};
        const reducer = createOptimisticReducer(nextReducer);
        reducer(state, action);
        expect(nextReducer.called).to.equal(true);
        expect(nextReducer.firstCall.args[0]).to.equal(state);
        expect(nextReducer.firstCall.args[1]).to.equal(action);
    });

    it('should call next reducer on initialization', () => {
        const nextReducer = sinon.spy(i => i);
        const state = {x: 1};
        const action = {type: 'any'};
        const reducer = createOptimisticReducer(nextReducer);
        const value = reducer(state, action);
        expect(value).to.deep.equal({x: 1, optimistic: false});
        expect(nextReducer.called).to.equal(true);
        expect(nextReducer.firstCall.args[0]).to.deep.equal(state);
        expect(nextReducer.firstCall.args[1]).to.equal(action);
    });

    it('should keep state with optimistic mark identical if nextReducer keeps it identical', () => {
        const nextReducer = sinon.spy(i => i);
        const state = {x: 1, optimistic: false};
        const action = {type: 'any'};
        const reducer = createOptimisticReducer(nextReducer);
        const value = reducer(state, action);
        expect(value).to.equal(state);
    });

    it('should work with null state', () => {
        const nextReducer = sinon.spy(i => i);
        const state = null;
        const action = {type: 'any'};
        const reducer = createOptimisticReducer(nextReducer);
        const value = reducer(state, action);
        expect(value).to.equal(null);
        expect(nextReducer.called).to.equal(true);
        expect(nextReducer.firstCall.args[0]).to.equal(state);
        expect(nextReducer.firstCall.args[1]).to.equal(action);
    });
});
