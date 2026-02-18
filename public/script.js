// Firebase config – make sure it matches YOUR actual config
const firebaseConfig = {
    apiKey: "AIzaSyD4Y2LnZ2rZX885CDDYrdnScREXHNhE30U",
    authDomain: "course-hub-6623d.firebaseapp.com",
    projectId: "course-hub-6623d",
    storageBucket: "course-hub-6623d.firebasestorage.app",
    messagingSenderId: "284574527241",
    appId: "1:284574527241:web:457968486b7f3d5e92add8",
    measurementId: "G-ZM3C6E8G6B"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// -------------------- Global Variables --------------------
let courses = [];
let currentUser = null;

// Default courses – will be used when a new user signs up
const DEFAULT_COURSES = [
  {
    code: "MAT120",
    name: "Calculus I",
    materials: [
      { type: "book", title: "Calculus: Early Transcendentals", url: "pdfs/calculus.pdf" },
      { type: "link", title: "Khan Academy - Calculus", url: "https://khanacademy.org/math/calculus-1" },
      { type: "pdf", title: "Lecture Notes Week 1", url: "pdfs/mat120_week1.pdf" },
      { type: "note", title: "Course Outline", url: "pdfs/outline.pdf" },
      { type: "audio", title: "AMi", url: "pdfs/ami.mp3" },
      { type: "recording", title: "Lecture 1 Recording", url: "pdfs/lecture1.mp4" }
    ]
  },
  {
    code: "CSE220",
    name: "Data Structures",
    materials: [
      { type: "book", title: "Introduction to Algorithms", url: "pdfs/clrs.pdf" },
      { type: "link", title: "GeeksforGeeks - DS", url: "https://geeksforgeeks.org/data-structures" }
    ]
  },
  {
    code: "PHY111",
    name: "General Physics I",
    materials: [
      { type: "pdf", title: "Mechanics Notes", url: "pdfs/phy111_mechanics.pdf" },
      { type: "link", title: "HyperPhysics", url: "http://hyperphysics.phy-astr.gsu.edu/" }
    ]
  },
  {
    code: "CHE101",
    name: "Introductory Chemistry",
    materials: [
      { type: "book", title: "Chemistry: The Central Science", url: "pdfs/chemistry.pdf" },
      { type: "link", title: "Periodic Table", url: "https://ptable.com/" }
    ]
  }
];

// -------------------- Auth State Observer --------------------
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    const signInForm = document.getElementById('sign-in-form');
    const userInfo = document.getElementById('user-info');
    const userDisplay = document.getElementById('user-display'); // changed from user-email

    if (user) {
        signInForm.style.display = 'none';
        userInfo.style.display = 'flex';
        userDisplay.textContent = user.displayName || user.email;
        await loadCoursesFromFirestore();
    } else {
        signInForm.style.display = 'block';
        userInfo.style.display = 'none';
        courses = [];
        renderCourses();
        document.getElementById('addCourseBtn').disabled = true;
    }
});

// -------------------- Sign Up --------------------
// -------------------- Show Sign Up Modal --------------------
document.getElementById('signup-btn').addEventListener('click', () => {
    document.getElementById('signup-modal').style.display = 'flex';
});

// -------------------- Cancel Sign Up Modal --------------------
document.getElementById('modal-cancel-btn').addEventListener('click', () => {
    document.getElementById('signup-modal').style.display = 'none';
    // Clear fields
    document.getElementById('signup-name').value = '';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('signup-confirm').value = '';
});

// -------------------- Modal Sign Up --------------------
document.getElementById('modal-signup-btn').addEventListener('click', async () => {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const confirm = document.getElementById('signup-confirm').value.trim();

    if (!name || !email || !password || !confirm) {
        alert('Please fill in all fields.');
        return;
    }
    if (password !== confirm) {
        alert('Passwords do not match.');
        return;
    }
    if (password.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Set display name
        await user.updateProfile({ displayName: name });

        // Upload default courses
        await uploadDefaultCoursesForUser(user.uid);

        // Create metadata document
        await db.collection('userMetadata').doc(user.uid).set({
            displayName: name,
            initialized: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Close modal and clear fields
        document.getElementById('signup-modal').style.display = 'none';
        document.getElementById('signup-name').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-confirm').value = '';

        // User is automatically signed in; auth observer will update UI.
    } catch (error) {
        console.error('Sign up error:', error);
        alert(error.message);
    }
});

// -------------------- Sign In --------------------
document.getElementById('signin-btn').addEventListener('click', async () => {
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value.trim();
    if (!email || !password) {
        alert('Please enter email and password.');
        return;
    }
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error('Sign in error:', error);
        alert(error.message);
    }
});
// -------------------- Forgot Password --------------------
document.getElementById('forgot-password-link').addEventListener('click', (e) => {
    e.preventDefault(); // prevent page jump

    const email = document.getElementById('signin-email').value.trim();
    if (!email) {
        alert('Please enter your email address first.');
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            alert(`Password reset email sent to ${email}. Check your inbox.`);
        })
        .catch((error) => {
            console.error('Password reset error:', error);
            let message = 'Error sending reset email. ';
            if (error.code === 'auth/user-not-found') {
                message = 'No account found with this email address.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Please enter a valid email address.';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many requests. Please try again later.';
            }
            alert(message);
        });
});

// Show change password modal
document.getElementById('change-password-btn').addEventListener('click', () => {
    document.getElementById('change-password-modal').style.display = 'flex';
});

// Cancel button in modal
document.getElementById('cancel-change-password').addEventListener('click', () => {
    document.getElementById('change-password-modal').style.display = 'none';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
});

// Save new password
document.getElementById('save-new-password').addEventListener('click', async () => {
    const newPass = document.getElementById('new-password').value.trim();
    const confirmPass = document.getElementById('confirm-password').value.trim();

    if (!newPass || !confirmPass) {
        alert('Please fill both fields.');
        return;
    }
    if (newPass !== confirmPass) {
        alert('Passwords do not match.');
        return;
    }
    if (newPass.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
    }

    try {
        await currentUser.updatePassword(newPass);
        alert('Password updated successfully!');
        // Close modal and clear fields
        document.getElementById('change-password-modal').style.display = 'none';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    } catch (error) {
        console.error('Password update error:', error);
        if (error.code === 'auth/requires-recent-login') {
            alert('For security, please sign out and sign in again before changing your password.');
        } else {
            alert('Error updating password. ' + error.message);
        }
    }
});

// -------------------- Delete Account --------------------
document.getElementById('delete-account-btn').addEventListener('click', async () => {
    if (!currentUser) return;

    // Double confirmation
    const confirm1 = confirm('Are you sure you want to delete your account?');
    if (!confirm1) return;

    const confirm2 = confirm('⚠️ THIS ACTION IS PERMANENT!\n\nAll your courses and materials will be permanently deleted. There is no undo. Are you absolutely sure?');
    if (!confirm2) return;

    try {
        // Delete all user data from Firestore
        console.log('Deleting user data...');

        // Delete all courses
        const userCoursesRef = db.collection('users').doc(currentUser.uid).collection('courses');
        const coursesSnapshot = await userCoursesRef.get();

        const batch = db.batch();
        coursesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete metadata document (if exists)
        const metadataRef = db.collection('userMetadata').doc(currentUser.uid);
        const metadataSnap = await metadataRef.get();
        if (metadataSnap.exists) {
            batch.delete(metadataRef);
        }

        await batch.commit();
        console.log('User data deleted from Firestore');

        // Finally delete the authentication account
        await currentUser.delete();
        console.log('User account deleted');
        // Auth state observer will sign out automatically

    } catch (error) {
        console.error('Error deleting account:', error);
        if (error.code === 'auth/requires-recent-login') {
            alert('For security, please sign out and sign in again before deleting your account.');
        } else {
            alert('Error deleting account. Please try again later.');
        }
    }
});

// -------------------- Sign Out --------------------
document.getElementById('sign-out-btn').addEventListener('click', async () => {
    try {
        await auth.signOut();
    } catch (error) {
        console.error('Sign out error:', error);
    }
});

// -------------------- Load Courses for Current User --------------------
async function loadCoursesFromFirestore() {
    if (!currentUser) return;
    const userCoursesRef = db.collection('users').doc(currentUser.uid).collection('courses');
    const metadataRef = db.collection('userMetadata').doc(currentUser.uid);
    
    try {
        const [snapshot, metadataSnap] = await Promise.all([
            userCoursesRef.get(),
            metadataRef.get()
        ]);

        if (snapshot.empty) {
            if (metadataSnap.exists) {
                courses = [];
                renderCourses();
                initDragAndDrop();
                document.getElementById('addCourseBtn').disabled = false;
            } else {
                console.log("New user, uploading defaults...");
                await uploadDefaultCoursesForUser(currentUser.uid);
                await metadataRef.set({
                    initialized: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                const newSnapshot = await userCoursesRef.get();
                courses = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderCourses();
                initDragAndDrop();
                document.getElementById('addCourseBtn').disabled = false;
            }
        } else {
            courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCourses();
            initDragAndDrop();
            document.getElementById('addCourseBtn').disabled = false;
        }
    } catch (error) {
        console.error("Error loading courses:", error);
    }
}

// -------------------- Upload Default Courses for a New User --------------------
async function uploadDefaultCoursesForUser(uid) {
    const batch = db.batch();
    DEFAULT_COURSES.forEach(course => {
        const docRef = db.collection('users').doc(uid).collection('courses').doc();
        batch.set(docRef, course);
    });
    await batch.commit();
}

// -------------------- Save Entire Courses Array to Firestore --------------------
async function saveCoursesToFirestore() {
    if (!currentUser) return;
    const userCoursesRef = db.collection('users').doc(currentUser.uid).collection('courses');
    try {
        const snapshot = await userCoursesRef.get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        const newBatch = db.batch();
        courses.forEach(course => {
            const { id, ...courseData } = course;
            const docRef = userCoursesRef.doc();
            newBatch.set(docRef, courseData);
        });
        await newBatch.commit();
        console.log("Courses saved to Firestore");
    } catch (error) {
        console.error("Error saving courses:", error);
    }
}

// -------------------- Render & Helper Functions --------------------
function renderCourses() {
    const container = document.getElementById('courseContainer');
    container.innerHTML = '';

    courses.forEach((course, index) => {
        const card = createCourseCard(course, index);
        container.appendChild(card);
        initMaterialSortable(card, index);
    });
}

function getTypeDisplayName(type) {
    const map = {
        book: 'Books',
        pdf: 'PDFs',
        link: 'Links',
        note: 'Notes (URL)',
        textnote: 'My Notes',
        recording: 'Class Recordings'
    };
    return map[type] || (type.charAt(0).toUpperCase() + type.slice(1) + 's');
}

function getIconForType(type) {
    const icons = {
        book: '📘',
        pdf: '📕',
        link: '🔗',
        note: '📓',
        textnote: '📝',
        audio: '🎤',
        recording: '📹'
    };
    return icons[type] || '📄';
}

function createCourseCard(course, courseIndex) {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.setAttribute('data-course-code', course.code);
    card.setAttribute('data-course-id', course.id);

    const header = document.createElement('div');
    header.className = 'course-header';
    header.innerHTML = `
        <span class="drag-handle" title="Drag to reorder course">⋮⋮</span>
        <div class="course-code">${course.code}</div>
        <div class="course-name">${course.name}</div>
        <button class="delete-course" title="Delete course" data-course-id="${course.id}">🗑️</button>
    `;
    card.appendChild(header);

    const materialsByType = {};
    course.materials.forEach(item => {
        const type = item.type;
        if (!materialsByType[type]) materialsByType[type] = [];
        materialsByType[type].push(item);
    });

    const typeOrder = ['book', 'pdf', 'link', 'recording', 'textnote', 'note'];
    const presentTypes = Object.keys(materialsByType);
    presentTypes.sort((a, b) => {
        const aIndex = typeOrder.indexOf(a);
        const bIndex = typeOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'material-sections';

    presentTypes.forEach(type => {
        const items = materialsByType[type];
        const section = document.createElement('div');
        section.className = 'material-section';

        const heading = document.createElement('h4');
        heading.className = 'material-category';
        heading.textContent = getTypeDisplayName(type);
        section.appendChild(heading);

        const list = document.createElement('ul');
        list.className = 'material-list';
        list.setAttribute('data-type', type);

        items.forEach(item => {
            const materialIndex = course.materials.findIndex(
                m => m.type === item.type && m.title === item.title && 
                     (item.type === 'textnote' ? m.content === item.content : m.url === item.url)
            );

            const li = document.createElement('li');
            li.className = `material-item ${item.type}`;
            li.setAttribute('data-material-index', materialIndex);

            const icon = getIconForType(item.type);

            if (item.type === 'textnote') {
                li.innerHTML = `
                    <span class="material-icon" title="Drag to reorder">${icon}</span>
                    <div class="note-content">
                        <strong>${item.title}</strong>
                        <p>${item.content.replace(/\n/g, '<br>')}</p>
                    </div>
                    <button class="delete-material" data-course-id="${course.id}" data-material-index="${materialIndex}">🗑️</button>
                `;
            } else {
                li.innerHTML = `
                    <span class="material-icon" title="Drag to reorder">${icon}</span>
                    <a href="${item.url}" class="material-link" target="_blank" rel="noopener">${item.title}</a>
                    <button class="delete-material" data-course-id="${course.id}" data-material-index="${materialIndex}">🗑️</button>
                `;
            }
            list.appendChild(li);
        });

        section.appendChild(list);
        sectionsContainer.appendChild(section);
    });

    card.appendChild(sectionsContainer);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-material';
    addBtn.innerHTML = '➕ Add Material';
    addBtn.addEventListener('click', () => showAddMaterialForm(card, course.id));
    card.appendChild(addBtn);

    return card;
}

// ✅ Correct showAddMaterialForm function (with note support)
function showAddMaterialForm(card, courseId) {
    const oldForm = card.querySelector('.add-material-form');
    if (oldForm) oldForm.remove();

    const form = document.createElement('div');
    form.className = 'add-material-form';
    
    const typeOptions = [
        { value: 'book', label: '📘 Book' },
        { value: 'pdf', label: '📕 PDF' },
        { value: 'link', label: '🔗 Link' },
        { value: 'note', label: '📓 Note (URL)' },
        { value: 'textnote', label: '📝 Write Note' },
        { value: 'audio', label: '🎤 Audio' },
        { value: 'recording', label: '📹 Class Recording' }
    ];
    
    let optionsHtml = '';
    typeOptions.forEach(opt => {
        optionsHtml += `<option value="${opt.value}">${opt.label}</option>`;
    });

    form.innerHTML = `
        <select id="mat-type">${optionsHtml}</select>
        <input type="text" id="mat-title" placeholder="Title (e.g. My Notes on Calculus)" />
        <div id="url-field">
            <input type="text" id="mat-url" placeholder="URL (e.g. pdfs/lecture1.mp4 or https://...)" />
        </div>
        <div id="note-field" style="display: none;">
            <textarea id="mat-content" rows="6" placeholder="Write your notes here..."></textarea>
        </div>
        <button id="save-material">Save Material</button>
        <button id="cancel-material">Cancel</button>
    `;
    card.appendChild(form);

    const typeSelect = document.getElementById('mat-type');
    const urlField = document.getElementById('url-field');
    const noteField = document.getElementById('note-field');
    
    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'textnote') {
            urlField.style.display = 'none';
            noteField.style.display = 'block';
        } else {
            urlField.style.display = 'block';
            noteField.style.display = 'none';
        }
    });

    document.getElementById('save-material').addEventListener('click', async () => {
        const type = typeSelect.value;
        const title = document.getElementById('mat-title').value.trim();
        
        if (!title) {
            alert('Please enter a title.');
            return;
        }

        let newMaterial;
        
        if (type === 'textnote') {
            const content = document.getElementById('mat-content').value.trim();
            if (!content) {
                alert('Please write some notes.');
                return;
            }
            newMaterial = { type, title, content };
        } else {
            const url = document.getElementById('mat-url').value.trim();
            if (!url) {
                alert('Please enter a URL.');
                return;
            }
            newMaterial = { type, title, url };
        }

        const courseIndex = courses.findIndex(c => c.id === courseId);
        if (courseIndex === -1) return;

        courses[courseIndex].materials.push(newMaterial);
        await saveCoursesToFirestore();
        await loadCoursesFromFirestore();
    });

    document.getElementById('cancel-material').addEventListener('click', () => {
        form.remove();
    });
}

// Add new course
document.getElementById('addCourseBtn').addEventListener('click', async () => {
    if (!currentUser) {
        alert('Please sign in first.');
        return;
    }
    const code = prompt('Enter course code (e.g. MAT130):');
    if (!code) return;
    const name = prompt('Enter course name (e.g. Linear Algebra):');
    if (!name) return;

    const newCourse = {
        code,
        name,
        materials: []
    };

    const userCoursesRef = db.collection('users').doc(currentUser.uid).collection('courses');
    await userCoursesRef.add(newCourse);
    await loadCoursesFromFirestore();
});

// Delete material
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-material')) {
        if (!currentUser) return;
        const courseId = e.target.getAttribute('data-course-id');
        const materialIndex = e.target.getAttribute('data-material-index');

        if (!courseId || materialIndex === null) return;

        const courseIndex = courses.findIndex(c => c.id === courseId);
        if (courseIndex === -1) return;

        courses[courseIndex].materials.splice(materialIndex, 1);
        await saveCoursesToFirestore();
        await loadCoursesFromFirestore();
    }
});

// Delete course
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-course')) {
        if (!currentUser) return;
        const courseId = e.target.getAttribute('data-course-id');
        if (!courseId) return;

        if (confirm('Are you sure you want to delete this entire course?')) {
            try {
                const userCoursesRef = db.collection('users').doc(currentUser.uid).collection('courses');
                await userCoursesRef.doc(courseId).delete();
                console.log('Course deleted');
                await loadCoursesFromFirestore();
            } catch (error) {
                console.error('Error deleting course:', error);
                alert('Failed to delete course. Check console.');
            }
        }
    }
});

// Drag & Drop for COURSES
function initDragAndDrop() {
    const container = document.getElementById('courseContainer');
    if (container.sortable) {
        container.sortable.destroy();
    }
    container.sortable = new Sortable(container, {
        animation: 250,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: async function() {
            const newOrder = [];
            const cards = container.querySelectorAll('.course-card');
            cards.forEach(card => {
                const id = card.getAttribute('data-course-id');
                const course = courses.find(c => c.id === id);
                if (course) newOrder.push(course);
            });
            if (newOrder.length === courses.length) {
                courses = newOrder;
                await saveCoursesToFirestore();
            }
        }
    });
}

// Drag & Drop for MATERIALS
function initMaterialSortable(card, courseIndex) {
    const lists = card.querySelectorAll('.material-list');
    lists.forEach(list => {
        if (list.sortable) {
            list.sortable.destroy();
        }
        list.sortable = new Sortable(list, {
            animation: 150,
            handle: '.material-icon',
            ghostClass: 'material-ghost',
            onEnd: async function() {
                const newMaterials = [];
                const listsInOrder = card.querySelectorAll('.material-list');
                listsInOrder.forEach(l => {
                    const type = l.getAttribute('data-type');
                    const items = l.querySelectorAll('.material-item');
                    items.forEach(item => {
                        // For textnote items, we need to get content; for others, URL
                        if (item.classList.contains('textnote')) {
                            const title = item.querySelector('strong').textContent;
                            const content = item.querySelector('p').textContent;
                            newMaterials.push({ type, title, content });
                        } else {
                            const link = item.querySelector('.material-link');
                            const title = link.textContent;
                            const url = link.getAttribute('href');
                            newMaterials.push({ type, title, url });
                        }
                    });
                });
                courses[courseIndex].materials = newMaterials;
                await saveCoursesToFirestore();
                await loadCoursesFromFirestore();
            }
        });
    });
}

// Add some style for dragging
const style = document.createElement('style');
style.innerHTML = `
    .sortable-ghost {
        opacity: 0.5;
        background: rgba(200, 230, 255, 0.8);
        box-shadow: 0 0 15px rgba(0,160,255,0.5);
    }
    .material-ghost {
        opacity: 0.5;
        background: rgba(210, 230, 250, 0.9);
    }
`;
document.head.appendChild(style);