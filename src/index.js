const toString = Object.prototype.toString;

const knownActionTypes = {
    rollback: '@@optimistic/ROLLBACK',
    mark: '@@optimistic/MARK',
};

const isKnownActionType = (() => {
    /* eslint-disable fecs-use-for-of, fecs-valid-map-set */
    const values = {};
    for (const key in knownActionTypes) {
        /* istanbul ignore else */
        if (knownActionTypes.hasOwnProperty(key)) {
            values[knownActionTypes[key]] = true;
        }
    }
    /* eslint-enable fecs-use-for-of, fecs-valid-map-set */

    return type => values.hasOwnProperty(type);
})();

const isPlainAction = action => toString.call(action) === '[object Object]' && !isKnownActionType(action.type);

export const createOptimisticManager = ({dispatch, getState}) => {
    // The last save point to rollback to
    let savePoint = null;
    // All plain object actions dispatched after save point
    let dispatchedActions = [];

    const saveActionOnDemand = (value, transactionId) => {
        if (savePoint) {
            dispatchedActions.push({value, transactionId});
        }
    };

    const markStateOptimisticOnDemand = () => {
        if (!getState().optimistic) {
            dispatch({type: knownActionTypes.mark});
        }
    };

    const createSavePointOnDemand = () => {
        if (!savePoint) {
            savePoint = getState();
        }
    };

    return {
        postAction(action, transactionId) {
            if (!isPlainAction(action)) {
                return action;
            }

            if (transactionId == null) {
                saveActionOnDemand(action);
            }
            else {
                createSavePointOnDemand();
                saveActionOnDemand(action, transactionId);
                markStateOptimisticOnDemand();
            }

            return action;
        },

        rollback(transactionId, replay = dispatch) {
            if (transactionId == null) {
                throw new Error('rollback requires a transaction id');
            }

            if (!savePoint) {
                return;
            }

            // Force state to match save point
            dispatch({type: knownActionTypes.rollback, payload: savePoint});

            let newSavePoint = null;
            const newDispatchedActions = [];

            // Because we will dispatch previously saved actions, make a copy here to prevent infinite loops
            for (const savedAction of dispatchedActions.slice()) {
                // Ignore all optimistic actions produced by the same transaction
                if (savedAction.transactionId === transactionId) {
                    continue;
                }

                const isOptimisticAction = savedAction.transactionId != null;

                // The next save point should be the first time an optimistic action is dispatched,
                // so any actions earlier than new save point should be safe to discard
                if (!newSavePoint && isOptimisticAction) {
                    newSavePoint = getState();
                }

                if (newSavePoint) {
                    newDispatchedActions.push(savedAction);
                }

                // Still mark state to optimistic if an optimistic action occurs
                if (isOptimisticAction && !getState().optimistic) {
                    dispatch({type: knownActionTypes.mark});
                }

                // Apply remaining action to make state up to time,
                // here we just need to apply all middlewares **after** redux-optimistic-manager,
                // so use `next` instead of global `dispatch`
                replay(savedAction.value);
            }

            savePoint = newSavePoint;
            dispatchedActions = newDispatchedActions;
        },
    };
};

const recoverOptimisticMark = state => {
    if (state && state.optimistic === undefined) {
        return {...state, optimistic: false};
    }

    return state;
};

export const createOptimisticReducer = nextReducer => (state, action) => {
    const nextState = recoverOptimisticMark(nextReducer(state, action));

    if (!nextState) {
        return nextState;
    }

    switch (action.type) {
        case knownActionTypes.rollback:
            return action.payload;
        case knownActionTypes.mark:
            return nextState.optimistic ? nextState : {...nextState, optimistic: true};
        default:
            return nextState;
    }
};
