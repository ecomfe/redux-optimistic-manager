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

    it('should return a function', () => {
        expect(typeof createOptimisticManager(createStore())).to.equal('function');
    });

    it('should provide action post and rollback functions in a transaction', () => {
        let store = createStore();
        let replay = () => {};
        let transaction = createOptimisticManager(store)(replay);
        expect(typeof transaction.postAction).to.equal('function');
        expect(typeof transaction.postOptimisticAction).to.equal('function');
        expect(typeof transaction.postExternalAction).to.equal('function');
        expect(typeof transaction.rollback).to.equal('function');
    });

    it('should set state to the one before the first optimistic action when rollback', () => {
        let store = createStore();
        let {postAction, postOptimisticAction, postExternalAction, rollback} = createOptimisticManager(store)(store.dispatch);
        store.setState(0);
        postAction({});
        store.setState(1);
        postExternalAction({});
        store.setState(2);
        postOptimisticAction({});
        store.setState(3);
        rollback();
        expect(store.actions.find(item => item.type === '@@optimistic/ROLLBACK').payload).to.equal(2);
    });

    it('should replay non-optimistic actions in the same trasaction after rollback', () => {
        let store = createStore();
        let replay = sinon.spy();
        let {postAction, postOptimisticAction, postExternalAction, rollback} = createOptimisticManager(store)(replay);
        let optimisticAction = {};
        let actualAction = {};
        postOptimisticAction(optimisticAction);
        postAction(actualAction);
        rollback();
        expect(replay.called).to.equal(true);
        expect(replay.getCall(0).args[0]).to.equal(actualAction);
    });

    it('should replay external actions in the same trasaction after rollback', () => {
        let store = createStore();
        let replay = sinon.spy();
        let {postAction, postOptimisticAction, postExternalAction, rollback} = createOptimisticManager(store)(replay);
        let optimisticAction = {};
        let externalAction = {};
        postOptimisticAction(optimisticAction);
        postExternalAction(externalAction);
        rollback();
        expect(replay.called).to.equal(true);
        expect(replay.getCall(0).args[0]).to.equal(externalAction);
    });

    it('should replay optimistic actions in other transactions after rollback', () => {
        let store = createStore();
        let replay = sinon.spy();
        let transaction = createOptimisticManager(store);
        let first = transaction(replay);
        let second = transaction(replay);
        let firstAction = {};
        let secondAction = {};
        first.postOptimisticAction(firstAction);
        second.postOptimisticAction(secondAction);
        second.rollback();
        expect(replay.called).to.equal(true);
        expect(replay.getCall(0).args[0]).to.equal(firstAction);
    });

    it('should not replay any action if no optimistic action dispatched', () => {
        let store = createStore();
        let replay = sinon.spy();
        let {postAction, postExternalAction, rollback} = createOptimisticManager(store)(replay);
        postAction({});
        postExternalAction({});
        rollback();
        expect(replay.called).to.equal(false);
    });

    it('should not replay non-plain actions', () => {
        let store = createStore();
        let replay = sinon.spy();
        let {postAction, postOptimisticAction, postExternalAction, rollback} = createOptimisticManager(store)(replay);
        postAction(1);
        postOptimisticAction(() => {});
        postExternalAction([]);
        rollback();
        expect(replay.called).to.equal(false);
    });

    it('should mark state as optimistic when the first optimistic action arrives', () => {
        let store = createStore();
        let replay = sinon.spy();
        let {postOptimisticAction} = createOptimisticManager(store)(replay);
        postOptimisticAction({});
        expect(store.actions.find(item => item.type === '@@optimistic/MARK')).to.not.equal(undefined);
    });

    it('should not dispatch mark action if state is already optimistic', () => {
        let store = createStore();
        let replay = sinon.spy();
        let {postOptimisticAction} = createOptimisticManager(store)(replay);
        store.setState({optimistic: true});
        postOptimisticAction({});
        expect(store.actions.find(item => item.type === '@@optimistic/MARK')).to.equal(undefined);
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
        expect(nextReducer.getCall(0).args[0]).to.equal(state);
        expect(nextReducer.getCall(0).args[1]).to.equal(action);
    });

    it('should call next reducer on initialization', () => {
        let nextReducer = sinon.spy();
        let state = {x: 1};
        let action = {type: 'any'};
        let reducer = createOptimisticReducer(nextReducer);
        let value = reducer(state, action);
        expect(nextReducer.called).to.equal(true);
        expect(nextReducer.getCall(0).args[0]).to.deep.equal({optimistic: false, x: 1});
        expect(nextReducer.getCall(0).args[1]).to.equal(action);
    })
});
