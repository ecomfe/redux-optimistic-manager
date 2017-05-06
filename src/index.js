/**
 * redux-optimistic-manager
 *
 * @file entry point
 * @author otakustay
 */

let toString = Object.prototype.toString;

let uid = (() => {
    let counter = 0;

    return () => ++counter;
})();

let knownActionTypes = {
    rollback: '@@optimistic/ROLLBACK',
    mark: '@@optimistic/MARK'
};

let isKnownActionType = (() => {
    /* eslint-disable fecs-use-for-of, fecs-valid-map-set */
    let values = {};
    for (let key in knownActionTypes) {
        /* istanbul ignore else */
        if (knownActionTypes.hasOwnProperty(key)) {
            values[knownActionTypes[key]] = true;
        }
    }
    /* eslint-enable fecs-use-for-of, fecs-valid-map-set */

    return type => values.hasOwnProperty(type);
})();

let isPlainAction = action => toString.call(action) === '[object Object]' && !isKnownActionType(action.type);

export let createOptimisticManager = ({dispatch, getState}) => {
    // The last save point to rollback to
    let savePoint = null;
    // All plain object actions dispatched after save point
    let dispatchedActions = [];

    let saveActionOnDemand = (value, optimistic, transactionId) => {
        if (savePoint) {
            dispatchedActions.push({value, optimistic, transactionId});
        }
    };

    let markStateOptimisticOnDemand = action => {
        if (!getState().optimistic) {
            dispatch({type: knownActionTypes.mark});
        }
    };

    let rollback = (transactionId, replay) => {
        if (!savePoint) {
            return;
        }

        // Force state to match save point
        dispatch({type: knownActionTypes.rollback, payload: savePoint});

        let newSavePoint = null;
        let newDispatchedActions = [];

        // Because we will dispatch previously saved actions, make a copy here to prevent infinite loops
        for (let savedAction of dispatchedActions.slice()) {
            // Ignore all optimistic actions produced by the same transaction
            if (savedAction.transactionId === transactionId && savedAction.optimistic) {
                continue;
            }

            // The next save point should be the first time an optimistic action is dispatched,
            // so any actions earlier than new save point should be safe to discard
            if (!newSavePoint && savedAction.optimistic) {
                newSavePoint = getState();
            }

            if (newSavePoint) {
                newDispatchedActions.push(savedAction);
            }

            // Still mark state to optimistic if an optimistic action occurs
            if (savedAction.optimistic && !getState().optimistic) {
                dispatch({type: knownActionTypes.mark});
            }

            // Apply remaining action to make state up to time,
            // here we just need to apply all middlewares **after** redux-optimistic-manager,
            // so use `next` instead of global `dispatch`
            replay(savedAction.value);
        }

        savePoint = newSavePoint;
        dispatchedActions = newDispatchedActions;
    };

    return replay => {
        let transactionId = uid();

        return {
            postAction(action) {
                if (isPlainAction(action)) {
                    saveActionOnDemand(action, false, transactionId);
                }
            },

            postOptimisticAction(action) {
                if (!isPlainAction(action)) {
                    return;
                }

                if (!savePoint) {
                    savePoint = getState();
                }

                saveActionOnDemand(action, true, transactionId);
                markStateOptimisticOnDemand();
            },

            postExternalAction(action) {
                if (isPlainAction(action)) {
                    saveActionOnDemand(action, false, null);
                }
            },

            rollback() {
                rollback(transactionId, replay);
            }
        };
    };
};

export let createOptimisticReducer = nextReducer => (state, action) => {
    if (state.optimistic === undefined) {
        state = {...state, optimistic: false};
    }

    switch (action.type) {
        case knownActionTypes.rollback:
            return action.payload;
        case knownActionTypes.mark:
            return state.optimistic ? state : {...state, optimistic: true};
        default:
            return nextReducer(state, action);
    }
};
