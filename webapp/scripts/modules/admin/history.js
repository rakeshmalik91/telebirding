export class UndoRedoManager {
    constructor(maxHistory = 50, storageKey = 'telebirding_admin_history') {
        this.maxHistory = maxHistory;
        this.storageKey = storageKey;
        this.undoStack = [];
        this.redoStack = [];
        this.onChange = null;
        this.etag = null;
    }

    loadFromStorage(currentEtag) {
        this.etag = currentEtag;
        try {
            const dataStr = sessionStorage.getItem(this.storageKey);
            if (dataStr) {
                const data = JSON.parse(dataStr);
                // Expiry of 24 hours (86400000 ms)
                if (Date.now() - data.timestamp < 86400000 && data.etag === currentEtag) {
                    this.undoStack = data.undoStack || [];
                    this.redoStack = data.redoStack || [];
                    if (this.onChange) this.onChange(this.undoStack.length > 0, this.redoStack.length > 0);
                    return;
                }
            }
        } catch (e) {
            console.warn("Could not load history from sessionStorage", e);
        }
        // If expired or etag mismatch or error, clear
        this.clear();
    }

    saveToStorage() {
        const data = {
            undoStack: this.undoStack,
            redoStack: this.redoStack,
            timestamp: Date.now(),
            etag: this.etag
        };
        try {
            sessionStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn("Could not save history to sessionStorage", e);
        }
    }

    createPatch(oldSightings, newSightings) {
        const oldMap = {};
        oldSightings.forEach(s => oldMap[s.key] = JSON.stringify(s));
        
        const newMap = {};
        newSightings.forEach(s => newMap[s.key] = JSON.stringify(s));

        const patch = {
            order: newSightings.map(s => s.key),
            changed: {}
        };

        newSightings.forEach(s => {
            if (oldMap[s.key] !== newMap[s.key]) {
                patch.changed[s.key] = JSON.parse(newMap[s.key]);
            }
        });
        return patch;
    }

    applyPatch(oldSightings, patch) {
        const oldMap = {};
        oldSightings.forEach(s => oldMap[s.key] = s);

        const newSightings = [];
        patch.order.forEach(key => {
            if (patch.changed[key]) {
                newSightings.push(JSON.parse(JSON.stringify(patch.changed[key])));
            } else if (oldMap[key]) {
                newSightings.push(JSON.parse(JSON.stringify(oldMap[key])));
            }
        });
        return newSightings;
    }

    pushState(oldSightings, newSightings) {
        const undoPatch = this.createPatch(newSightings, oldSightings);
        const redoPatch = this.createPatch(oldSightings, newSightings);
        
        // Check if there are any actual changes
        const hasChanges = Object.keys(redoPatch.changed).length > 0;
        let orderChanged = oldSightings.length !== redoPatch.order.length;
        if (!orderChanged) {
            for (let i = 0; i < oldSightings.length; i++) {
                if (oldSightings[i].key !== redoPatch.order[i]) {
                    orderChanged = true;
                    break;
                }
            }
        }
        
        // If no changes at all, don't push a blank state
        if (!hasChanges && !orderChanged) return;

        this.undoStack.push({ undoPatch, redoPatch });
        
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        
        this.redoStack = [];
        
        if (this.onChange) this.onChange(this.undoStack.length > 0, this.redoStack.length > 0);
        this.saveToStorage();
    }

    undo(currentSightings) {
        if (this.undoStack.length === 0) return currentSightings;
        const state = this.undoStack.pop();
        this.redoStack.push(state);
        
        const newSightings = this.applyPatch(currentSightings, state.undoPatch);
        
        if (this.onChange) this.onChange(this.undoStack.length > 0, this.redoStack.length > 0);
        this.saveToStorage();
        return newSightings;
    }

    redo(currentSightings) {
        if (this.redoStack.length === 0) return currentSightings;
        const state = this.redoStack.pop();
        this.undoStack.push(state);
        
        const newSightings = this.applyPatch(currentSightings, state.redoPatch);
        
        if (this.onChange) this.onChange(this.undoStack.length > 0, this.redoStack.length > 0);
        this.saveToStorage();
        return newSightings;
    }
    
    resetMemory() {
        this.undoStack = [];
        this.redoStack = [];
        if (this.onChange) this.onChange(false, false);
    }
    
    clear() {
        this.resetMemory();
        try {
            sessionStorage.removeItem(this.storageKey);
        } catch (e) {}
    }
}
