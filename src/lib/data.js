import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
  } from "firebase/firestore";
  
  import { db } from "./firebase";
  
  function records(uid, type) {
    return collection(db, "users", uid, type);
  }
  
  export async function listRecords(uid, type) {
    const snapshot = await getDocs(
      query(records(uid, type), orderBy("date", "desc"))
    );
  
    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  }
  
  export async function addRecord(uid, type, data) {
    const ref = await addDoc(records(uid, type), {
      ...data,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  
    return { id: ref.id, ...data };
  }
  
  export async function updateRecord(uid, type, id, data) {
    return updateDoc(doc(db, "users", uid, type, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }
  
  export async function deleteRecord(uid, type, id) {
    return deleteDoc(doc(db, "users", uid, type, id));
  }