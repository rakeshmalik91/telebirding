import Util from '../util.js';
import FirebaseApi from '../firebase-api.js';
import { showLoader, hideLoader } from '../loader.js';
import { customAlert } from './ui.js';

export function tryLogin(password) {
    showLoader("login", "Logging in");
    FirebaseApi.getFirebase().auth().signInWithEmailAndPassword("rakeshmalik91@gmail.com", password).then(() => {
        $('.data').show();
        $("#login-page").hide();
        if ($("#login-page input[name=rememberme]").is(":checked")) {
            Util.setCookie("credentials", password, 7);
        }
        hideLoader("login");
    }).catch(e => {
        hideLoader("login");
        customAlert(e.message);
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
