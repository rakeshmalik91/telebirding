/**
 * Custom Modal System
 */

function showModal(title, message, isConfirm, callback) {
    const $overlay = $('#custom-modal-overlay');
    const $title = $('#custom-modal-title');
    const $msg = $('#custom-modal-message');
    const $cancel = $('#custom-modal-cancel');
    const $confirm = $('#custom-modal-confirm');

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
    }, 10);
}

function closeModal() {
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
