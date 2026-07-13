/**
 * Searchable Select Component
 * 
 * Wraps native <select> elements with a searchable dropdown overlay.
 * Features:
 * - Search by text (and data-search-terms if present)
 * - Clear button
 * - Multiple selection (if select has 'multiple' attribute)
 * - Tags (custom input) support via data-tags="true"
 */

const SEARCHABLE_CLASS = 'searchable-select';
const WRAPPER_CLASS = 'ss-wrapper';
const DISPLAY_CLASS = 'ss-display';
const DISPLAY_TEXT_CLASS = 'ss-display-text';
const CLEAR_BTN_CLASS = 'ss-clear-btn';
const DROPDOWN_CLASS = 'ss-dropdown';
const SEARCH_CLASS = 'ss-search';
const OPTIONS_CLASS = 'ss-options';
const OPTION_CLASS = 'ss-option';
const OPTION_SELECTED_CLASS = 'ss-option-selected';

export function initSearchableSelect(selectEl) {
    const $select = $(selectEl);
    if ($select.data('ss-initialized')) return;
    $select.data('ss-initialized', true);

    const isMultiple = $select.prop('multiple');
    const allowTags = $select.data('tags') === true || $select.data('tags') === 'true';
    const isIconOnly = $select.data('icon-only') === true || $select.data('icon-only') === 'true';
    const noClear = $select.data('no-clear') === true || $select.data('no-clear') === 'true';

    // Read width and max-width before hiding
    const width = $select[0].style.width || $select.css('width') || '200px';
    const maxWidth = $select[0].style.maxWidth || $select.css('max-width');

    // Hide native select
    $select.addClass(SEARCHABLE_CLASS);

    // Create wrapper
    const $wrapper = $('<div>').addClass(WRAPPER_CLASS);
    $wrapper.css('width', width);
    if (maxWidth && maxWidth !== 'none') $wrapper.css('max-width', maxWidth);

    // Create display area
    const $display = $('<div>').addClass(DISPLAY_CLASS);
    $display.css('width', width);
    if (maxWidth && maxWidth !== 'none') $display.css('max-width', maxWidth);
    if ($select.css('font-size')) {
        $display.css('font-size', $select.css('font-size'));
    }

    const $displayText = $('<span>').addClass(DISPLAY_TEXT_CLASS);
    const $clearBtn = $('<span>').addClass(CLEAR_BTN_CLASS).html('&#x2715;').attr('title', 'Clear');
    $display.append($displayText, $clearBtn);

    if (noClear) {
        $display.addClass('no-clear');
    }
    
    // Create dropdown
    const $dropdown = $('<div>').addClass(DROPDOWN_CLASS);
    $dropdown.css('min-width', width);
    const $search = $('<input>').addClass(SEARCH_CLASS).attr('placeholder', 'Search...');
    const $options = $('<div>').addClass(OPTIONS_CLASS);
    $dropdown.append($search, $options);

    // Wrap the select
    $select.before($wrapper);
    $wrapper.append($select, $display, $dropdown);

    function updateDisplay() {
        // Remove unselected custom options
        $select.find('option[data-custom="true"]').each(function () {
            if (!$(this).prop('selected')) {
                $(this).remove();
            }
        });

        let text = '';
        let firstIconHtml = null;

        if (isMultiple) {
            let vals = $select.val();
            // If val() is empty or not fully initialized, manually check the options
            if (!vals || vals.length === 0) {
                vals = $select.find('option').filter(function () {
                    return this.selected || this.hasAttribute('selected');
                }).map(function () { return $(this).val(); }).get();
            }
            vals = vals || [];

            if (vals.length === 1) {
                const opt = $select.find('option').filter(function () { return $(this).val() == vals[0]; });
                text = opt.length ? opt.text() : vals[0];
                if (opt.length && opt.attr('data-icon')) firstIconHtml = opt.attr('data-icon');
            } else if (vals.length > 1) {
                const selectedTexts = vals.map(v => {
                    const opt = $select.find('option').filter(function () { return $(this).val() == v; });
                    if (!firstIconHtml && opt.length && opt.attr('data-icon')) firstIconHtml = opt.attr('data-icon');
                    return opt.length ? opt.text() : v;
                });
                text = selectedTexts.join(', ');
            }
        } else {
            const selectedOption = $select.find('option:selected');
            text = selectedOption.text() || '';
            firstIconHtml = selectedOption.attr('data-icon');
            // For custom tags where option might not exist yet, read value directly if text is empty
            if (!text && allowTags && $select.val()) {
                text = $select.val();
            }
        }

        if (isIconOnly) {
            const displayIcon = $select.attr('data-display-icon') || '📷';
            $display.addClass('icon-only');
            $displayText.text(displayIcon).css({
                'text-align': 'center',
                'font-size': '16px',
                'flex': 'none',
                'margin': '0'
            });
            $clearBtn.hide();
            $display.css({
                'padding': '4px 6px',
                'justify-content': 'center'
            });
            if (text) {
                $displayText.css('color', '#38bdf8'); // Highlight when something is selected
                $display.attr('title', text);
                $display.addClass('has-value');
            } else {
                $displayText.css('color', '#cbd5e1'); // Default icon color
                $display.attr('title', $select.attr('title') || 'Select camera/lens');
                $display.removeClass('has-value');
            }
            return;
        }

        if (!text && $select.attr('placeholder')) {
            $displayText.text($select.attr('placeholder')).css('color', '#64748b');
        } else {
            if (firstIconHtml) {
                $displayText.html(firstIconHtml + '<span style="font-size: 11px; margin-left: 2px;">' + text + '</span>').css('color', '');
            } else {
                $displayText.text(text).css('color', '');
            }
        }
        $display.attr('title', text);

        let hasRealValue = false;
        if (isMultiple) {
            let vals = $select.val() || [];
            hasRealValue = vals.length > 0;
        } else {
            let val = $select.val();
            hasRealValue = val !== '' && val !== null && val !== undefined;
        }

        if (hasRealValue) {
            $display.addClass('has-value');
        } else {
            $display.removeClass('has-value');
        }
    }

    function buildOptions(filter) {
        $options.empty();
        const filterLower = (filter || '').toLowerCase();

        let exactMatch = false;

        $select.find('option').each(function () {
            const $opt = $(this);
            const text = $opt.text();
            const val = $opt.val();

            // Skip placeholder empty options in search
            if (!text.trim()) return;

            const searchTerms = ($opt.data('search-terms') || '').toLowerCase();
            const searchText = text.toLowerCase() + ' ' + searchTerms;

            if (filterLower && !searchText.includes(filterLower)) return;

            if (filterLower && text.toLowerCase() === filterLower) {
                exactMatch = true;
            }

            const $optDiv = $('<div>').addClass(OPTION_CLASS)
                .attr('data-value', val)
                .attr('title', text);
            
            const iconHtml = $opt.attr('data-icon');
            if (iconHtml) {
                $optDiv.html(iconHtml + '<span style="font-size: 11px; margin-left: 2px;">' + text + '</span>');
            } else {
                $optDiv.text(text);
            }

            if ($opt.is(':selected')) {
                $optDiv.addClass(OPTION_SELECTED_CLASS);
                if (isMultiple) {
                    $optDiv.prepend('<span style="margin-right:8px;font-size:10px;height:10px;">✓</span>');
                }
            }
            $options.append($optDiv);
        });

        // Add custom tag option if allowed and no exact match
        if (allowTags && filterLower && !exactMatch) {
            const $optDiv = $('<div>').addClass(OPTION_CLASS).addClass('ss-option-new')
                .html(`Add: <strong>${filter}</strong>`)
                .attr('data-value', filter)
                .attr('data-is-new', 'true');
            $options.prepend($optDiv);
        }
    }

    function openDropdown() {
        $(document).trigger('click.ss');
        
        $search.val('');
        buildOptions('');

        $dropdown.appendTo(document.body).css({ display: 'flex', visibility: 'hidden', width: '', minWidth: '' });
        const dropdownHeight = $dropdown.outerHeight();
        const dropdownWidth = $dropdown.outerWidth();
        $dropdown.css({ display: '', visibility: '' });

        const rect = $wrapper[0].getBoundingClientRect();
        
        let topPos = rect.bottom + 4;
        if (topPos + dropdownHeight > window.innerHeight && rect.top - dropdownHeight - 4 > 0) {
            topPos = rect.top - dropdownHeight - 4;
        }

        let leftPos = rect.left;
        if (leftPos + dropdownWidth > window.innerWidth) {
            leftPos = rect.right - dropdownWidth;
            if (leftPos < 0) leftPos = 10;
        }

        $dropdown.css({
            position: 'fixed',
            top: topPos + 'px',
            left: leftPos + 'px',
            minWidth: rect.width + 'px',
            margin: 0,
            zIndex: 99999
        });

        $dropdown.addClass('open');
        setTimeout(() => $search.focus(), 10);
    }

    function closeDropdown() {
        if (!$dropdown.hasClass('open')) return;
        $dropdown.removeClass('open');
        $dropdown.css({
            position: '',
            top: '',
            left: '',
            width: '',
            minWidth: '',
            margin: '',
            zIndex: ''
        });
        $wrapper.append($dropdown);
    }

    $display.on('click', function (e) {
        // Prevent click if clicking clear button
        if ($(e.target).closest('.' + CLEAR_BTN_CLASS).length) return;

        e.stopPropagation();
        if ($dropdown.hasClass('open')) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    $clearBtn.on('click', function (e) {
        e.stopPropagation();
        if (isMultiple) {
            $select.val([]).trigger('change');
        } else {
            $select.val('').trigger('change');
        }
        updateDisplay();
        closeDropdown();
    });

    $search.on('input', function () {
        buildOptions($(this).val());
    });

    $search.on('click', function (e) {
        e.stopPropagation();
    });

    $options.on('click', '.' + OPTION_CLASS, function (e) {
        e.stopPropagation();
        const val = $(this).attr('data-value');
        const isNew = $(this).attr('data-is-new') === 'true';

        if (isNew) {
            // Add new option to select
            const newOption = new Option(val, val, false, false);
            newOption.setAttribute('data-custom', 'true');
            $select.append(newOption);
        }

        if (isMultiple) {
            let currentVals = $select.val() || [];
            if (!Array.isArray(currentVals)) currentVals = [currentVals];

            const index = currentVals.indexOf(val);
            if (index > -1) {
                currentVals.splice(index, 1);
            } else {
                currentVals.push(val);
            }
            $select.val(currentVals).trigger('change');
            buildOptions($search.val()); // Rebuild to update checkboxes
            updateDisplay();
        } else {
            $select.val(val).trigger('change');
            updateDisplay();
            closeDropdown();
        }
    });

    $(document).on('click.ss', function () {
        closeDropdown();
    });

    $dropdown.on('click', function (e) {
        e.stopPropagation();
    });

    $search.on('keydown', function (e) {
        if (e.key === 'Escape') {
            closeDropdown();
        } else if (e.key === 'Enter') {
            const $first = $options.find('.' + OPTION_CLASS).first();
            if ($first.length) {
                $first.click(); // Trigger click logic
            }
        }
    });

    $select.on('change.ss', function () {
        updateDisplay();
    });

    updateDisplay();
    return $select;
}

export function initSearchableSelects($container, selector) {
    $container.find(selector).each(function () {
        initSearchableSelect(this);
    });
}

// Global listeners to close dropdowns when scrolling outside or resizing
if (!window._ss_listeners_added) {
    window._ss_listeners_added = true;
    window.addEventListener('scroll', function(e) {
        if ($(e.target).closest('.ss-dropdown').length) return;
        $(document).trigger('click.ss');
    }, true);

    window.addEventListener('resize', function() {
        $(document).trigger('click.ss');
    });
}
