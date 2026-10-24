import Util from '../util.js';

export class Autocomplete {
    constructor(inp, arr, onSelect) {
        this.inp = inp;
        this.arr = arr;
        this.onSelect = onSelect;
        this.currentFocus = -1;
        this.init();
    }

    init() {
        if (!this.inp) return;

        // Remove any existing autocomplete list
        this.closeAllLists();

        // Input event listener
        this.inp.addEventListener("input", (e) => this.onInput(e));

        // Keydown event listener
        this.inp.addEventListener("keydown", (e) => this.onKeyDown(e));

        // Click listener to close lists
        document.addEventListener("click", (e) => {
            this.closeAllLists(e.target);
        });
    }

    onInput(e) {
        let a, b, i, val = this.inp.value;
        this.closeAllLists();
        if (!val) return false;
        this.currentFocus = -1;

        a = document.createElement("DIV");
        a.setAttribute("id", this.inp.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        this.inp.parentNode.appendChild(a);

        const normVal = Util.normalizeForTagMatch(val);

        for (i = 0; i < this.arr.length; i++) {
            const item = this.arr[i];
            const normItem = Util.normalizeForTagMatch(item);

            const isExactPrefix = item.substr(0, val.length).toUpperCase() === val.toUpperCase();
            const isNormPrefix = normItem.startsWith(normVal);
            const isNormWordMatch = normItem.includes(" " + normVal);

            if (isExactPrefix || isNormPrefix || isNormWordMatch) {
                b = document.createElement("DIV");
                if (isExactPrefix) {
                    let strong = document.createElement("STRONG");
                    strong.textContent = item.substr(0, val.length);
                    b.appendChild(strong);
                    b.appendChild(document.createTextNode(item.substr(val.length)));
                } else {
                    b.appendChild(document.createTextNode(item));
                }
                let hiddenInput = document.createElement("INPUT");
                hiddenInput.type = "hidden";
                hiddenInput.value = item;
                b.appendChild(hiddenInput);

                b.addEventListener("mousedown", (e) => {
                    // Prevent blur event on input to ensure we capture the selection first
                    e.preventDefault();

                    const selectedValue = e.currentTarget.getElementsByTagName("input")[0].value;
                    this.inp.value = selectedValue;

                    this.closeAllLists();
                    if (this.onSelect) this.onSelect(selectedValue);
                });
                a.appendChild(b);
            }
        }
    }

    onKeyDown(e) {
        let x = document.getElementById(this.inp.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");

        if (e.keyCode == 40) { // DOWN
            this.currentFocus++;
            this.addActive(x);
        } else if (e.keyCode == 38) { // UP
            this.currentFocus--;
            this.addActive(x);
        } else if (e.keyCode == 13) { // ENTER
            e.preventDefault();
            if (this.currentFocus > -1) {
                // Simulate selection manually since we listen to mousedown now, and click() won't trigger it
                const selectedValue = x[this.currentFocus].getElementsByTagName("input")[0].value;
                this.inp.value = selectedValue;
                this.closeAllLists();
                if (this.onSelect) this.onSelect(selectedValue);
            } else {
                // If no item selected via arrows, but Enter pressed, check if we should trigger select
                // Or just close list. For now, close list. 
                // Optionally if exact match, trigger select? 
                // Let's stick to closing logic or fallback trigger if needed.
                // Keeping it simple: close list.
                this.closeAllLists();
                // If the user typed an exact full match manually and hit enter, maybe trigger?
                // For now relying on click or arrow selection.
                // If manual typing + enter is desired to trigger filter, main.js usually handles that via form/change?
                // But we are overriding behavior.
                // Let's ensure callback is called if value is non-empty? 
                if (this.onSelect && this.inp.value) this.onSelect(this.inp.value);
            }
        }
    }

    addActive(x) {
        if (!x) return false;
        this.removeActive(x);
        if (this.currentFocus >= x.length) this.currentFocus = 0;
        if (this.currentFocus < 0) this.currentFocus = (x.length - 1);
        x[this.currentFocus].classList.add("autocomplete-active");
    }

    removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }

    closeAllLists(elmnt) {
        let x = document.getElementsByClassName("autocomplete-items");
        for (let i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != this.inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
}
