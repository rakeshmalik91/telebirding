export function setupChipInputs() {
    $(document).on('click', '.chip-input-container', function(e) {
        if (!$(e.target).closest('.chip, .chip-remove').length) {
            $(this).find('.chip-input').focus();
        }
    });

    $(document).on('keydown', '.chip-input', function(e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            let val = $(this).val().trim();
            if (val.endsWith(',')) val = val.slice(0, -1).trim();
            
            if (val) {
                addChip($(this).closest('.chip-input-container'), val);
                $(this).val('');
            }
        } else if (e.key === 'Backspace' && $(this).val() === '') {
            let $wrapper = $(this).closest('.chip-input-container').find('.chips-wrapper');
            if ($wrapper.children().length > 0) {
                $wrapper.children().last().remove();
                updateChipHiddenField($(this).closest('.chip-input-container'));
            }
        }
    });

    $(document).on('click', '.chip-remove', function(e) {
        e.stopPropagation();
        let $container = $(this).closest('.chip-input-container');
        $(this).closest('.chip').remove();
        updateChipHiddenField($container);
    });
}

function addChip($container, val) {
    let $wrapper = $container.find('.chips-wrapper');
    // Check for duplicates
    if ($wrapper.find('.chip').filter(function() {
        return $(this).text().replace('×', '').trim() === val;
    }).length === 0) {
        $wrapper.append('<div class="chip"><span>' + val + '</span><span class="chip-remove" title="Remove">&times;</span></div>');
        updateChipHiddenField($container);
    }
}

function updateChipHiddenField($container) {
    let tags = [];
    $container.find('.chip span:first-child').each(function() {
        tags.push($(this).text().trim());
    });
    
    let $hidden = $container.find('input[type=hidden]');
    $hidden.val(tags.join(', ')).trigger('input').trigger('change');
}

export function setChips($container, tagString) {
    let $wrapper = $container.find('.chips-wrapper');
    $wrapper.empty();
    
    if (tagString && tagString.trim()) {
        let tags = tagString.split(',').map(t => t.trim()).filter(t => t);
        tags.forEach(t => {
            $wrapper.append('<div class="chip"><span>' + t + '</span><span class="chip-remove" title="Remove">&times;</span></div>');
        });
    }
    updateChipHiddenField($container);
}
