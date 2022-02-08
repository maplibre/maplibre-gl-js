function handleOperation(map, operations, opIndex, done) {
    const operation = operations[opIndex];
    const opName = operation[0];
    //Delegate to special handler if one is available
    if (opName in operationHandlers) {
        operationHandlers[opName](map, operation.slice(1), () => {
            done(opIndex);
        });
    } else {
        map[opName](...operation.slice(1));
        done(opIndex);
    }
}

export const operationHandlers = {
    wait(map, params, done) {
        const wait = function() {
            if (map.loaded()) {
                done();
            } else {
                map.once('render', wait);
            }
        };
        wait();
    },
    idle(map, params, done) {
        const idle = function() {
            if (!map.isMoving()) {
                done();
            } else {
                map.once('render', idle);
            }
        };
        idle();
    }
};

export function applyOperations(map, operations, done) {
    // No operations specified, end immediately and invoke done.
    if (!operations || operations.length === 0) {
        done();
        return;
    }

    // Start recursive chain
    const scheduleNextOperation = (lastOpIndex) => {
        if (lastOpIndex === operations.length - 1) {
            // Stop recusive chain when at the end of the operations
            done();
            return;
        }

        handleOperation(map, operations, ++lastOpIndex, scheduleNextOperation);
    };
    scheduleNextOperation(-1);
}
