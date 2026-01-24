import Util from '../util.js';
import FirebaseApi from '../firebase-api.js';
import { showOverlay } from '../ui-helpers.js';

export function tryLogin(password) {
    showOverlay("Logging in");
    FirebaseApi.getFirebase().auth().signInWithEmailAndPassword("rakeshmalik91@gmail.com", password).then(() => {
        $('.data').show();
        $("#login-page").hide();
        if ($("#login-page input[name=rememberme]").is(":checked")) {
            Util.setCookie("credentials", password, 7);
        }
        $(".overlay:not(#crop-modal)").hide();
    }).catch(e => {
        alert(e.message);
    });
}

export function setupAuthListeners() {
    if (Util.getCookie("credentials")) {
        setTimeout(() => { tryLogin(Util.getCookie("credentials")); }, 1000);
    }
    $("#login-page button").click(function () {
        tryLogin($("#login-page input[type=password]").val());
    });
    $("#login-page input").keypress(function (e) {
        if (e.code == 'Enter') {
            tryLogin($("#login-page input[type=password]").val());
        }
    });
    $("button.logout").click(function () {
        Util.eraseCookie("credentials");
        location.reload();
    });
}
