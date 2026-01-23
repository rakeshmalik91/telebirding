export default class FirebaseApi {
    static FIREBASE_ENABLED = !window.location.origin.match(/.*(localhost|:5000).*/ig) || window.location.pathname == '/admin';
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

    static moveFile(oldPath, newPath) {
        const oldRef = FirebaseApi.getFirebase().storage().ref(oldPath);
        const newRef = FirebaseApi.getFirebase().storage().ref(newPath);

        return oldRef.getDownloadURL().then(url => {
            return fetch(url);
        }).then(response => {
            return response.blob();
        }).then(blob => {
            return newRef.put(blob);
        }).then(() => {
            return oldRef.delete();
        });
    }
}
