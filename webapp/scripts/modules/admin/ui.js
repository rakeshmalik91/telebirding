/**
 * Custom Modal System
 */

export function showModal(title, message, isConfirm, callback) {
    const $overlay = $('#custom-modal-overlay');
    const $title = $('#custom-modal-title');
    const $msg = $('#custom-modal-message');
    const $cancel = $('#custom-modal-cancel');
    const $confirm = $('#custom-modal-confirm');

    $overlay.find('.custom-modal-content').removeClass('custom-modal-wide');
    $title.text(title);
    
    // Replace \n with <br> for multiline alerts
    if (typeof message === 'string') {
        $msg.html(message.replace(/\n/g, '<br>'));
    } else {
        $msg.text(message);
    }

    $cancel.off('click');
    $confirm.off('click');

    if (isConfirm) {
        $cancel.show();
        $cancel.on('click', () => {
            closeModal();
            if (callback) callback(false);
        });
    } else {
        $cancel.hide();
    }

    $confirm.on('click', () => {
        closeModal();
        if (callback) callback(true);
    });

    $overlay.css('display', 'flex');
    // small timeout to allow display:flex to apply before adding class for transition
    setTimeout(() => {
        $overlay.addClass('visible');
        $confirm.trigger('focus');
    }, 10);

    $(document).off('keydown.customModal').on('keydown.customModal', (e) => {
        if ($overlay.css('display') === 'none') return;
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
            if (callback) callback(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
            if (isConfirm && callback) callback(false);
            else if (!isConfirm && callback) callback(true);
        }
    });
}

export function closeModal() {
    $(document).off('keydown.customModal');
    const $overlay = $('#custom-modal-overlay');
    $overlay.removeClass('visible');
    setTimeout(() => {
        $overlay.css('display', 'none');
    }, 200); // match CSS transition time
}

export function customAlert(message) {
    showModal('Alert', message, false, null);
}

export function customConfirm(message, callback) {
    showModal('Confirm', message, true, (result) => {
        if (result && callback) {
            callback();
        }
    });
}

export function customSelectModal(title, message, options, callback) {
    const $overlay = $('#custom-modal-overlay');
    const $title = $('#custom-modal-title');
    const $msg = $('#custom-modal-message');
    const $cancel = $('#custom-modal-cancel');
    const $confirm = $('#custom-modal-confirm');

    $overlay.find('.custom-modal-content').removeClass('custom-modal-wide');
    $overlay.find('.custom-modal-content').addClass('custom-modal-wide');
    $title.text(title);
    $msg.empty();

    if (message) {
        const $p = $('<div style="margin-bottom: 12px;"></div>').text(message);
        $msg.append($p);
    }

    const $list = $('<div class="custom-modal-options" style="display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto; text-align: left;"></div>');
    (options || []).forEach((opt, idx) => {
        const $row = $('<label style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.3); cursor: pointer;"></label>');
        const $radio = $('<input type="radio" name="custom-modal-select" />').val(opt.value);
        if (idx === 0) $radio.prop('checked', true);
        $row.append($radio);
        if (opt.thumb) {
            const $img = $('<img alt="" style="width: 56px; height: 56px; object-fit: cover; border-radius: 4px; flex-shrink: 0;" />').attr('src', opt.thumb);
            $row.append($img);
        }
        const $text = $('<span></span>').text(opt.label);
        $row.append($text);
        $list.append($row);
    });
    $msg.append($list);

    const getSelected = () => $list.find('input[name="custom-modal-select"]:checked').val() || null;

    $cancel.off('click');
    $confirm.off('click');
    $cancel.show();

    $cancel.on('click', () => {
        closeModal();
        if (callback) callback(null);
    });

    $confirm.on('click', () => {
        const selected = getSelected();
        closeModal();
        if (callback) callback(selected);
    });

    $overlay.css('display', 'flex');
    setTimeout(() => {
        $overlay.addClass('visible');
        $confirm.trigger('focus');
    }, 10);

    $(document).off('keydown.customModal').on('keydown.customModal', (e) => {
        if ($overlay.css('display') === 'none') return;
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const selected = getSelected();
            closeModal();
            if (callback) callback(selected);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
            if (callback) callback(null);
        }
    });
}

export function showToast(message, type = 'info') {
    if ($('#toast-container').length === 0) {
        $('body').append('<div id="toast-container" style="position: fixed; bottom: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 10px;"></div>');
    }
    
    const borderColor = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#38bdf8');
    const bg = '#1e293b';
    const fg = '#f8fafc';
    
    const $toast = $(`<div style="background: ${bg}; border-left: 4px solid ${borderColor}; color: ${fg}; padding: 12px 20px; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); font-size: 14px; opacity: 0; transform: translateX(100%); transition: all 0.3s ease;">${message}</div>`);
    
    $('#toast-container').append($toast);
    
    // trigger reflow
    $toast[0].offsetHeight;
    
    $toast.css({
        opacity: 1,
        transform: 'translateX(0)'
    });
    
    setTimeout(() => {
        $toast.css({
            opacity: 0,
            transform: 'translateX(100%)'
        });
        setTimeout(() => {
            $toast.remove();
        }, 300);
    }, 3000);
}
