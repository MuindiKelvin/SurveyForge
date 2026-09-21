import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBVEDjBiZ5KP4k1x-2jnfEsSGBC4Lo-swM",
  authDomain: "survey-app-fdddd.firebaseapp.com",
  databaseURL: "https://survey-app-fdddd-default-rtdb.firebaseio.com",
  projectId: "survey-app-fdddd",
  storageBucket: "survey-app-fdddd.firebasestorage.app",
  messagingSenderId: "312339791234",
  appId: "1:312339791234:web:b942d14f22b5185b97e39b",
  measurementId: "G-81ZWNC6QSD"
};

const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'appId'];

/** False until the .env file has been filled in with real Firebase values. */
export const isFirebaseConfigured = REQUIRED.every((key) => {
  const value = firebaseConfig[key];
  return typeof value === 'string' && value.trim() !== '' && !value.startsWith('YOUR_');
});

let app = null;
let auth = null;
let db = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

export { app, auth, db, googleProvider };
