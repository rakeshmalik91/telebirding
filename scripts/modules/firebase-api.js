export default class FirebaseApi {
    static FIREBASE_ENABLED = !window.location.origin.match(/.*(localhost|:5000).*/ig);
    // static FIREBASE_ENABLED = true;
    static FIREBASE_APPCHECK_ENABLED = false;

    static #firebaseInitialized = false;

    static config = {
        apiKey: "AIzaSyApVjVcNDeMkA-oz-tYa46Lm-Ja7qCCVjQ",
        authDomain: "telebirding-49623.firebaseapp.com",
        projectId: "telebirding-49623",
        storageBucket: "telebirding-49623.appspot.com",
        messagingSenderId: "660434055884",
        appId: "1:660434055884:web:43dd0ca8c46f8280250869",
        measurementId: "G-MRPL6NX33K"
    };
    static recaptchaKey = "6LdY-eIrAAAAAPBNq0RoVnRfRGLUZ3VqissKhq5r";

    static getFirebase() {
        if (FirebaseApi.#firebaseInitialized)
            return firebase;
        firebase.initializeApp(FirebaseApi.config);
        if (FirebaseApi.FIREBASE_APPCHECK_ENABLED) {
            // TODO: app check enforcement
            firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider(FirebaseApi.recaptchaKey), true);
        }
        FirebaseApi.#firebaseInitialized = true;
        return firebase;
    }
}
