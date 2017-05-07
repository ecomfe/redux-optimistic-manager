import {expect} from 'chai';
import sinon from 'sinon';
import {createOptimisticManager, createOptimisticReducer} from '../src/index';

let createStore = () => {
    let actions = [];
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
        }
    };
};

describe('createOptimisticManager', () => {
    it('should be a function', () => {
        expect(typeof createOptimisticManager).to.equal('function');
    });

    it('should return postAction and rollback function', () => {
        let store = createStore();
        let {postAction, rollback} = createOptimisticManager(store);
        expect(typeof postAction).to.equal('function');
        expect(typeof rollback).to.equal('function');
    });

    it('should return the input action for postAction function', () => {
        let store = createStore();
        let postAction = createOptimisticManager(store).postAction;
        let action = {};
        expect(postAction(action)).to.equal(action);
        let thunk = () => {};
        expect(postAction(thunk)).to.equal(thunk);
    });

    it('should throw when no transactionId is provided to rollback function', () => {
        let store = createStore();
        let rollback = createOptimisticManager(store).rollback;
        expect(rollback).to.throw();
    });

    it('should set state to the one before the first optimistic action when rollback', () => {
        let store = createStore();
        let transactionId = 1;
        let {postAction, rollback} = createOptimisticManager(store);
        store.setState(0);
        postAction({});
        store.setState(1);
        postAction({}, transactionId);
        store.setState(2);
        rollback(transactionId, store.dispatch);
        expect(store.actions.find(item => item.type === '@@optimistic/ROLLBACK').payload).to.equal(1);
    });

    it('should replay non-optimistic actions after rollback', () => {
        let store = createStore();
        let transactionId = 1;
        let replay = sinon.spy();
        let {postAction, rollback} = createOptimisticManager(store);
        let optimisticAction = {};
        let actualAction = {};
        postAction(optimisticAction, transactionId);
        postAction(actualAction);
        rollback(transactionId, replay);
        expect(replay.called).to.equal(true);
        expect(replay.firstCall.args[0]).to.equal(actualAction);
    });

    it('should replay optimistic actions in other transactions after rollback', () => {
        let store = createStore();
        let replay = sinon.spy();
        let {postAction, rollback} = createOptimisticManager(store);
        let firstAction = {};
        let secondAction = {};
        let thirdAction = {};
        postAction(firstAction, 1);
        postAction(secondAction, 2);
        postAction(thirdAction, 3);
        rollback(2, replay);
        expect(replay.called).to.equal(true);
        expect(replay.firstCall.args[0]).to.equal(firstAction);
        expect(replay.secondCall.args[0]).to.equal(thirdAction);
    });

    it('should not replay any action if no optimistic action dispatched', () => {
        let store = createStore();
        let replay = sinon.spy();
        let {postAction, rollback} = createOptimisticManager(store);
        postAction({});
        rollback(1, replay);
        expect(replay.called).to.equal(false);
    });

    it('should not replay non-plain actions', () => {
        let store = createStore();
        let replay = sinon.spy();
        let {postAction, rollback} = createOptimisticManager(store);
        postAction(1);
        postAction(() => {});
        postAction([]);
        rollback(1, replay);
        expect(replay.called).to.equal(false);
    });

    it('should use dispatch as default replay function', () => {
        let store = createStore();
        sinon.spy(store, 'dispatch');
        let transactionId = 1;
        let {postAction, rollback} = createOptimisticManager(store);
        let optimisticAction = {};
        let actualAction = {};
        postAction(optimisticAction, transactionId);
        postAction(actualAction);
        rollback(transactionId);
        expect(store.dispatch.called).to.equal(true);
        expect(store.dispatch.lastCall.args[0]).to.equal(actualAction);
    });

    it('should mark state as optimistic when the first optimistic action arrives', () => {
        let store = createStore();
        let replay = sinon.spy();
        let postAction = createOptimisticManager(store).postAction;
        postAction({}, 1);
        expect(store.actions.some(item => item.type === '@@optimistic/MARK')).to.not.equal(false);
    });

    it('should not dispatch mark action if state is already optimistic', () => {
        let store = createStore();
        let replay = sinon.spy();
        let postAction = createOptimisticManager(store).postAction;
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
        let reducer = createOptimisticReducer(n => n);
        let value = reducer({}, {type: 'any'});
        expect(value).to.deep.equal({optimistic: false});
    });

    it('should produce rollback state for @@optimistic/ROLLBACK action', () => {
        let state = {optimistic: false, x: 1};
        let reducer = createOptimisticReducer(n => n);
        let value = reducer({optimistic: false}, {type: '@@optimistic/ROLLBACK', payload: state});
        expect(value).to.equal(state);
    });

    it('should mark state as optimistic in @@optimistic/MARK action', () => {
        let state = {optimistic: false, x: 1};
        let reducer = createOptimisticReducer(n => n);
        let value = reducer(state, {type: '@@optimistic/MARK'});
        expect(value).to.deep.equal({x: 1, optimistic: true});
    });

    it('should return input state if state is already optimistic in @@optimistic/MARK action', () => {
        let state = {optimistic: true, x: 1};
        let reducer = createOptimisticReducer(n => n);
        let value = reducer(state, {type: '@@optimistic/MARK'});
        expect(value).to.equal(state);
    });

    it('should call next reducer for unknown action type', () => {
        let nextReducer = sinon.spy();
        let state = {optimistic: false};
        let action = {type: 'any'};
        let reducer = createOptimisticReducer(nextReducer);
        let value = reducer(state, action);
        expect(nextReducer.called).to.equal(true);
        expect(nextReducer.firstCall.args[0]).to.equal(state);
        expect(nextReducer.firstCall.args[1]).to.equal(action);
    });

    it('should call next reducer on initialization', () => {
        let nextReducer = sinon.spy();
        let state = {x: 1};
        let action = {type: 'any'};
        let reducer = createOptimisticReducer(nextReducer);
        let value = reducer(state, action);
        expect(nextReducer.called).to.equal(true);
        expect(nextReducer.firstCall.args[0]).to.deep.equal({optimistic: false, x: 1});
        expect(nextReducer.firstCall.args[1]).to.equal(action);
    })
});
