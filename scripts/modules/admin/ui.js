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
