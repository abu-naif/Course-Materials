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
    const userDisplay = document.getElementById('user-display');

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

// -------------------- Sign Up Modal --------------------
document.getElementById('signup-btn').addEventListener('click', () => {
    document.getElementById('signup-modal').style.display = 'flex';
});

document.getElementById('modal-cancel-btn').addEventListener('click', () => {
    document.getElementById('signup-modal').style.display = 'none';
    document.getElementById('signup-name').value = '';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('signup-confirm').value = '';
});

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

        await user.updateProfile({ displayName: name });
        await uploadDefaultCoursesForUser(user.uid);
        await db.collection('userMetadata').doc(user.uid).set({
            displayName: name,
            initialized: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('signup-modal').style.display = 'none';
        document.getElementById('signup-name').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-confirm').value = '';
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
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    if (!email) {
        alert('Please enter your email address first.');
        return;
    }
    auth.sendPasswordResetEmail(email)
        .then(() => alert(`Password reset email sent to ${email}. Check your inbox.`))
        .catch((error) => {
            console.error('Password reset error:', error);
            let message = 'Error sending reset email. ';
            if (error.code === 'auth/user-not-found') message = 'No account found with this email address.';
            else if (error.code === 'auth/invalid-email') message = 'Please enter a valid email address.';
            else if (error.code === 'auth/too-many-requests') message = 'Too many requests. Please try again later.';
            alert(message);
        });
});

// -------------------- Change Password --------------------
document.getElementById('change-password-btn').addEventListener('click', () => {
    document.getElementById('change-password-modal').style.display = 'flex';
});

document.getElementById('cancel-change-password').addEventListener('click', () => {
    document.getElementById('change-password-modal').style.display = 'none';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
});

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
    if (!confirm('Are you sure you want to delete your account?')) return;
    if (!confirm('⚠️ THIS ACTION IS PERMANENT!\n\nAll your courses and materials will be permanently deleted. There is no undo. Are you absolutely sure?')) return;

    try {
        const userCoursesRef = db.collection('users').doc(currentUser.uid).collection('courses');
        const coursesSnapshot = await userCoursesRef.get();
        const batch = db.batch();
        coursesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        const metadataRef = db.collection('userMetadata').doc(currentUser.uid);
        const metadataSnap = await metadataRef.get();
        if (metadataSnap.exists) batch.delete(metadataRef);
        await batch.commit();
        await currentUser.delete();
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
    try { await auth.signOut(); } catch (error) { console.error('Sign out error:', error); }
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

        if (!snapshot.empty) {
            courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            courses.sort((a, b) => a.order - b.order);
            renderCourses();
            initDragAndDrop();
            document.getElementById('addCourseBtn').disabled = false;
            return;
        }

        if (metadataSnap.exists) {
            courses = [];
            renderCourses();
            initDragAndDrop();
            document.getElementById('addCourseBtn').disabled = false;
        } else {
            console.log("New user, uploading defaults...");
            await uploadDefaultCoursesForUser(currentUser.uid);
            await metadataRef.set({
                displayName: currentUser.displayName || 'Anonymous',
                initialized: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const newSnapshot = await userCoursesRef.get();
            courses = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            courses.sort((a, b) => a.order - b.order);
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
    DEFAULT_COURSES.forEach((course, index) => {
        const docRef = db.collection('users').doc(uid).collection('courses').doc();
        batch.set(docRef, { ...course, order: index });
    });
    await batch.commit();
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

        <div class="course-main">
            <div class="course-code">${course.code}</div>
            <div class="course-name">${course.name}</div>
        </div>

        <div class="course-actions">
            <button class="edit-course" title="Edit course" data-course-id="${course.id}">✏️</button>
            <button class="delete-course" title="Delete course" data-course-id="${course.id}">🗑️</button>
        </div>
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
            li.setAttribute('data-course-id', course.id);

            const icon = getIconForType(item.type);

            let contentHtml = '';
            if (item.type === 'textnote') {
                contentHtml = `
                    <div class="material-content">
                        <div class="material-title">${item.title}</div>
                        <div class="note-preview">${item.content.substring(0, 60)}${item.content.length > 60 ? '…' : ''}</div>
                    </div>
                `;
            } else {
                contentHtml = `
                    <div class="material-content">
                        <a href="${item.url}" class="material-link" target="_blank" rel="noopener">${item.title}</a>
                    </div>
                `;
            }

            const buttonsHtml = `
                <div class="material-actions">
                    <button class="edit-material" data-course-id="${course.id}" data-material-index="${materialIndex}" title="Edit">✏️</button>
                    <button class="delete-material" data-course-id="${course.id}" data-material-index="${materialIndex}" title="Delete">🗑️</button>
                </div>
            `;

            li.innerHTML = `
                <span class="material-icon" title="Drag to reorder">${icon}</span>
                ${contentHtml}
                ${buttonsHtml}
            `;

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

// -------------------- Edit Course --------------------
let currentEditCourseId = null;

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-course')) {
        const courseId = e.target.getAttribute('data-course-id');
        if (!courseId) return;
        const course = courses.find(c => c.id === courseId);
        if (!course) return;
        currentEditCourseId = courseId;
        document.getElementById('edit-course-code').value = course.code;
        document.getElementById('edit-course-name').value = course.name;
        document.getElementById('edit-course-modal').style.display = 'flex';
    }
});

document.getElementById('cancel-course-edit').addEventListener('click', () => {
    document.getElementById('edit-course-modal').style.display = 'none';
    currentEditCourseId = null;
});

document.getElementById('save-course-edit').addEventListener('click', async () => {
    if (!currentEditCourseId) return;
    const newCode = document.getElementById('edit-course-code').value.trim();
    const newName = document.getElementById('edit-course-name').value.trim();
    if (!newCode || !newName) {
        alert('Please fill both fields.');
        return;
    }
    const courseIndex = courses.findIndex(c => c.id === currentEditCourseId);
    if (courseIndex === -1) return;

    courses[courseIndex].code = newCode;
    courses[courseIndex].name = newName;

    const courseRef = db.collection('users').doc(currentUser.uid).collection('courses').doc(currentEditCourseId);
    await courseRef.update({ code: newCode, name: newName });

    document.getElementById('edit-course-modal').style.display = 'none';
    currentEditCourseId = null;
    renderCourses();
    initDragAndDrop();
});

// -------------------- Add Material Form --------------------
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
    const sections = card.querySelector('.material-sections');
    sections.appendChild(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

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
        const courseRef = db.collection('users').doc(currentUser.uid).collection('courses').doc(courseId);
        await courseRef.update({ materials: courses[courseIndex].materials });

        renderCourses();
        initDragAndDrop();
    });

    document.getElementById('cancel-material').addEventListener('click', () => {
        form.remove();
    });
}

// -------------------- Add New Course --------------------
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
        materials: [],
        order: courses.length
    };

    const userCoursesRef = db.collection('users').doc(currentUser.uid).collection('courses');
    await userCoursesRef.add(newCourse);
    await loadCoursesFromFirestore();
});

// -------------------- Delete Material --------------------
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-material')) {
        if (!currentUser) return;
        const courseId = e.target.getAttribute('data-course-id');
        const materialIndex = e.target.getAttribute('data-material-index');
        if (!courseId || materialIndex === null) return;

        const courseIndex = courses.findIndex(c => c.id === courseId);
        if (courseIndex === -1) return;

        courses[courseIndex].materials.splice(materialIndex, 1);
        const courseRef = db.collection('users').doc(currentUser.uid).collection('courses').doc(courseId);
        await courseRef.update({ materials: courses[courseIndex].materials });

        renderCourses();
        initDragAndDrop();
    }
});

// -------------------- Delete Course --------------------
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

// -------------------- Drag & Drop for COURSES --------------------
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
            cards.forEach((card, index) => {
                const id = card.getAttribute('data-course-id');
                const course = courses.find(c => c.id === id);
                if (course) {
                    course.order = index;
                    newOrder.push(course);
                }
            });
            if (newOrder.length === courses.length) {
                courses = newOrder;
                const batch = db.batch();
                courses.forEach(course => {
                    const courseRef = db.collection('users').doc(currentUser.uid).collection('courses').doc(course.id);
                    batch.update(courseRef, { order: course.order });
                });
                await batch.commit();
                renderCourses();
                initDragAndDrop();
            }
        }
    });
}

// -------------------- Drag & Drop for MATERIALS --------------------
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
                        if (item.classList.contains('textnote')) {
                            const materialIndex = item.getAttribute('data-material-index');
                            if (materialIndex !== null) {
                                const original = courses[courseIndex].materials[materialIndex];
                                newMaterials.push(original);
                            }
                        } else {
                            const link = item.querySelector('.material-link');
                            if (link) {
                                const title = link.textContent;
                                const url = link.getAttribute('href');
                                newMaterials.push({ type, title, url });
                            }
                        }
                    });
                });
                if (newMaterials.length === courses[courseIndex].materials.length) {
                    courses[courseIndex].materials = newMaterials;
                    const courseRef = db.collection('users').doc(currentUser.uid).collection('courses').doc(courses[courseIndex].id);
                    await courseRef.update({ materials: newMaterials });
                    renderCourses();
                    initDragAndDrop();
                } else {
                    console.warn('Material count mismatch – reloading from Firestore');
                    await loadCoursesFromFirestore();
                }
            }
        });
    });
}

// -------------------- Edit Material --------------------
let currentEditMaterial = { courseId: null, materialIndex: null };

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-material')) {
        const courseId = e.target.getAttribute('data-course-id');
        const materialIndex = e.target.getAttribute('data-material-index');
        if (!courseId || materialIndex === null) return;

        const course = courses.find(c => c.id === courseId);
        if (!course) return;
        const material = course.materials[materialIndex];
        if (!material) return;

        currentEditMaterial = { courseId, materialIndex: parseInt(materialIndex) };

        document.getElementById('edit-mat-title').value = material.title;
        if (material.type === 'textnote') {
            document.getElementById('edit-url-field').style.display = 'none';
            document.getElementById('edit-note-field').style.display = 'block';
            document.getElementById('edit-mat-content').value = material.content || '';
        } else {
            document.getElementById('edit-url-field').style.display = 'block';
            document.getElementById('edit-note-field').style.display = 'none';
            document.getElementById('edit-mat-url').value = material.url || '';
        }
        document.getElementById('edit-material-modal').style.display = 'flex';
    }
});

document.getElementById('cancel-material-edit').addEventListener('click', () => {
    document.getElementById('edit-material-modal').style.display = 'none';
    currentEditMaterial = { courseId: null, materialIndex: null };
});

document.getElementById('save-material-edit').addEventListener('click', async () => {
    const { courseId, materialIndex } = currentEditMaterial;
    if (!courseId || materialIndex === null) return;

    const courseIndex = courses.findIndex(c => c.id === courseId);
    if (courseIndex === -1) return;

    const material = courses[courseIndex].materials[materialIndex];
    const newTitle = document.getElementById('edit-mat-title').value.trim();
    if (!newTitle) {
        alert('Title cannot be empty.');
        return;
    }

    if (material.type === 'textnote') {
        const newContent = document.getElementById('edit-mat-content').value.trim();
        if (!newContent) {
            alert('Note content cannot be empty.');
            return;
        }
        courses[courseIndex].materials[materialIndex].title = newTitle;
        courses[courseIndex].materials[materialIndex].content = newContent;
    } else {
        const newUrl = document.getElementById('edit-mat-url').value.trim();
        if (!newUrl) {
            alert('URL cannot be empty.');
            return;
        }
        courses[courseIndex].materials[materialIndex].title = newTitle;
        courses[courseIndex].materials[materialIndex].url = newUrl;
    }

    const courseRef = db.collection('users').doc(currentUser.uid).collection('courses').doc(courseId);
    await courseRef.update({ materials: courses[courseIndex].materials });

    document.getElementById('edit-material-modal').style.display = 'none';
    currentEditMaterial = { courseId: null, materialIndex: null };
    renderCourses();
    initDragAndDrop();
});

// -------------------- Note Popup --------------------
console.log('Popup code is running');
const notePopup = document.getElementById('note-popup');
const closeNoteBtn = document.getElementById('close-note-popup');

if (notePopup && closeNoteBtn) {
    document.addEventListener('click', (e) => {
        const noteItem = e.target.closest('.material-item.textnote');
        if (!noteItem) return;
        if (e.target.closest('button')) return;

        const courseId = noteItem.getAttribute('data-course-id');
        const materialIndex = noteItem.getAttribute('data-material-index');

        if (!courseId || materialIndex === null) return;

        const course = courses.find(c => c.id === courseId);
        if (!course) return;

        const material = course.materials[materialIndex];
        if (!material || material.type !== 'textnote') return;

        document.getElementById('popup-note-title').textContent = material.title;
        document.getElementById('popup-note-content').innerHTML = material.content.replace(/\n/g, '<br>');

        notePopup.style.display = 'flex';
        setTimeout(() => {
            notePopup.style.opacity = '1';
            notePopup.querySelector('div').style.transform = 'scale(1)';
        }, 10);
    });

    closeNoteBtn.addEventListener('click', closePopup);

    notePopup.addEventListener('click', (e) => {
        if (e.target === notePopup) closePopup();
    });

    function closePopup() {
        notePopup.style.opacity = '0';
        notePopup.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => {
            notePopup.style.display = 'none';
        }, 300);
    }
} else {
    console.error('Note popup elements not found in the DOM.');
}