// -------------------- Firebase Configuration --------------------
// Replace this object with your own from Firebase console
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD4Y2LnZ2rZX885CDDYrdnScREXHNhE30U",
  authDomain: "course-hub-6623d.firebaseapp.com",
  projectId: "course-hub-6623d",
  storageBucket: "course-hub-6623d.firebasestorage.app",
  messagingSenderId: "284574527241",
  appId: "1:284574527241:web:457968486b7f3d5e92add8",
  measurementId: "G-ZM3C6E8G6B"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// -------------------- Global Variables --------------------
let courses = [];
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

// -------------------- Load from Firestore on page load --------------------
async function loadCoursesFromFirestore() {
    try {
        const snapshot = await db.collection('courses').get();
        if (snapshot.empty) {
            // No data yet – upload default courses
            console.log("No courses found, uploading defaults...");
            await uploadDefaultCourses();
            // Then load again
            const newSnapshot = await db.collection('courses').get();
            courses = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        renderCourses();
        initDragAndDrop();
    } catch (error) {
        console.error("Error loading courses:", error);
    }
}

async function uploadDefaultCourses() {
    const batch = db.batch();
    DEFAULT_COURSES.forEach(course => {
        const docRef = db.collection('courses').doc(); // auto-generated ID
        batch.set(docRef, course);
    });
    await batch.commit();
}

// -------------------- Save entire courses array to Firestore --------------------
async function saveCoursesToFirestore() {
    try {
        // First, delete all existing documents in the 'courses' collection
        const snapshot = await db.collection('courses').get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // Now upload current courses array
        const newBatch = db.batch();
        courses.forEach(course => {
            // Remove the 'id' field if present (we don't want to store it)
            const { id, ...courseData } = course;
            const docRef = db.collection('courses').doc(); // new random ID
            newBatch.set(docRef, courseData);
        });
        await newBatch.commit();
        console.log("Courses saved to Firestore");
    } catch (error) {
        console.error("Error saving courses:", error);
    }
}

// -------------------- Render & Helper Functions (mostly unchanged) --------------------
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
        audio: '🎤',
        recording: '📹'
    };
    return icons[type] || '📄';
}

function createCourseCard(course, courseIndex) {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.setAttribute('data-course-code', course.code);
    card.setAttribute('data-course-id', course.id); // store Firestore doc ID

    // Header with drag handle
    const header = document.createElement('div');
    header.className = 'course-header';
    header.innerHTML = `
        <span class="drag-handle" title="Drag to reorder course">⋮⋮</span>
        <div class="course-code">${course.code}</div>
        <div class="course-name">${course.name}</div>
    `;
    card.appendChild(header);

    // Group materials by type
    const materialsByType = {};
    course.materials.forEach(item => {
        const type = item.type;
        if (!materialsByType[type]) materialsByType[type] = [];
        materialsByType[type].push(item);
    });

    const typeOrder = ['book', 'pdf', 'link', 'recording'];
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
            // For delete, we need a unique identifier – use combination of properties
            // Since we don't have IDs, we'll use the index in the materials array (careful after reorder)
            // We'll rely on the fact that after any change we re-render, so indices are fresh
            const materialIndex = course.materials.findIndex(
                m => m.type === item.type && m.title === item.title && m.url === item.url
            );

            const li = document.createElement('li');
            li.className = `material-item ${item.type}`;
            li.setAttribute('data-material-index', materialIndex); // store for delete

            const icon = getIconForType(item.type);

            li.innerHTML = `
                <span class="material-icon" title="Drag to reorder">${icon}</span>
                <a href="${item.url}" class="material-link" target="_blank" rel="noopener">${item.title}</a>
                <button class="delete-material" data-course-id="${course.id}" data-material-index="${materialIndex}">🗑️</button>
            `;
            list.appendChild(li);
        });

        section.appendChild(list);
        sectionsContainer.appendChild(section);
    });

    card.appendChild(sectionsContainer);

    // Add material button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-material';
    addBtn.innerHTML = '➕ Add Material';
    addBtn.addEventListener('click', () => showAddMaterialForm(card, course.id));
    card.appendChild(addBtn);

    return card;
}

// Show add material form
function showAddMaterialForm(card, courseId) {
    const oldForm = card.querySelector('.add-material-form');
    if (oldForm) oldForm.remove();

    const form = document.createElement('div');
    form.className = 'add-material-form';
    
    const typeOptions = [
        { value: 'book', label: '📘 Book' },
        { value: 'pdf', label: '📕 PDF' },
        { value: 'link', label: '🔗 Link' },
        { value: 'note', label: '📓 Note' },
        { value: 'audio', label: '🎤 Audio' },
        { value: 'recording', label: '📹 Class Recording' }
    ];
    
    let optionsHtml = '';
    typeOptions.forEach(opt => {
        optionsHtml += `<option value="${opt.value}">${opt.label}</option>`;
    });

    form.innerHTML = `
        <select id="mat-type">${optionsHtml}</select>
        <input type="text" id="mat-title" placeholder="Title (e.g. Lecture 1 Recording)" />
        <input type="text" id="mat-url" placeholder="URL (e.g. pdfs/lecture1.mp4 or https://...)" />
        <button id="save-material">Save Material</button>
        <button id="cancel-material">Cancel</button>
    `;
    card.appendChild(form);

    document.getElementById('save-material').addEventListener('click', async () => {
        const type = document.getElementById('mat-type').value;
        const title = document.getElementById('mat-title').value.trim();
        const url = document.getElementById('mat-url').value.trim();
        if (!title || !url) {
            alert('Please fill both title and URL.');
            return;
        }

        // Find the course in the courses array by its Firestore ID
        const courseIndex = courses.findIndex(c => c.id === courseId);
        if (courseIndex === -1) return;

        courses[courseIndex].materials.push({ type, title, url });

        // Save to Firestore
        await saveCoursesToFirestore();

        // Re-render
        await loadCoursesFromFirestore(); // reload to get updated data
    });

    document.getElementById('cancel-material').addEventListener('click', () => {
        form.remove();
    });
}

// Add new course
document.getElementById('addCourseBtn').addEventListener('click', async () => {
    const code = prompt('Enter course code (e.g. MAT130):');
    if (!code) return;
    const name = prompt('Enter course name (e.g. Linear Algebra):');
    if (!name) return;

    const newCourse = {
        code,
        name,
        materials: []
    };

    // Add to Firestore directly
    await db.collection('courses').add(newCourse);
    // Reload from Firestore
    await loadCoursesFromFirestore();
});

// Delete material
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-material')) {
        const courseId = e.target.getAttribute('data-course-id');
        const materialIndex = e.target.getAttribute('data-material-index');

        if (!courseId || materialIndex === null) return;

        const courseIndex = courses.findIndex(c => c.id === courseId);
        if (courseIndex === -1) return;

        // Remove the material
        courses[courseIndex].materials.splice(materialIndex, 1);

        // Save to Firestore
        await saveCoursesToFirestore();

        // Reload from Firestore
        await loadCoursesFromFirestore();
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
                // No need to reload – we just saved the new order.
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
                // Rebuild materials for this course based on DOM order
                const newMaterials = [];
                const listsInOrder = card.querySelectorAll('.material-list');
                listsInOrder.forEach(l => {
                    const type = l.getAttribute('data-type');
                    const items = l.querySelectorAll('.material-item');
                    items.forEach(item => {
                        const link = item.querySelector('.material-link');
                        const title = link.textContent;
                        const url = link.getAttribute('href');
                        newMaterials.push({ type, title, url });
                    });
                });
                courses[courseIndex].materials = newMaterials;
                await saveCoursesToFirestore();
                // Reload from Firestore to keep everything consistent
                await loadCoursesFromFirestore();
            }
        });
    });
}

// Start the app
loadCoursesFromFirestore();

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