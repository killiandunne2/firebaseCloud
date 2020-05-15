const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// auth trigger (new user)
exports.newUserSignup = functions.auth.user().onCreate(user => {
  return admin.firestore().collection('users').doc(user.uid).set({
    email: user.email,
    upvotedOn: []
  });

});

// auth trigger (user deleted)
exports.userDeleted = functions.auth.user().onDelete(user => {
  const doc = admin.firestore().collection('users').doc(user.uid);
  return doc.delete();
});

// http callable function (adding a request)
exports.addRequest = functions.https.onCall((data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'only authenticated users can make requests'
    );
  }
  if (data.text.length > 30) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'request must be no longer than 30 characters long'
    );
  }
  return admin.firestore().collection('requests').add({
    text: data.text,
    upvotes: 0,
  });
});


exports.upvote = functions.https.onCall(async (data, context) => {
  //check the auth state
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'only authenticated users can make requests'
    );
  }
  // get refs for user doc and request doc
  const user = admin.firestore().collection('users').doc(context.auth.uid);
  const request = admin.firestore().collection('requests').doc(data.id);

  // check the user hasn't already upvoted
  const doc = await user.get();
  if (doc.data().upvotedOn.includes(data.id)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'You can only upvote something once'
    );
  }

  // update user array
  await user.update({
    upvotedOn: [...doc.data().upvotedOn, data.id]
  });
    // update votes on request
  return request.update({
    upvotes: admin.firestore.FieldValue.increment(1)
  });
});

exports.logActivities = functions.firestore.document('/{collection}/{id}')
  .onCreate((snap, context) => {
    const collection = context.params.collection;
    const id = context.params.id;
    console.log(snap.data);

    const activities = admin.firestore().collection('activities');
    if (collection === 'requests') {
      return activities.add({ text: 'a new tutorial request was added' });
    } else if (collection === 'users') {
      return activities.add({ text: 'a new user signed up' });
    }

    return null;

  });
