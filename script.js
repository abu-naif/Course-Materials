// Default data (your four courses) – used only the very first time
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

// Load data from localStorage, or use defaults if none exists
let courses = loadCourses();

// Render all courses, then enable drag & drop
renderCourses();
initDragAndDrop();

// --- Helper functions ---

function loadCourses() {
  const stored = localStorage.getItem('courseHub');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored courses, using defaults.');
      return DEFAULT_COURSES;
    }
  } else {
    // First visit: save defaults and return them
    localStorage.setItem('courseHub', JSON.stringify(DEFAULT_COURSES));
    return DEFAULT_COURSES;
  }
}

function saveCourses() {
  localStorage.setItem('courseHub', JSON.stringify(courses));
}

function renderCourses() {
  const container = document.getElementById('courseContainer');
  container.innerHTML = ''; // Clear existing

  courses.forEach((course, index) => {
    const card = createCourseCard(course, index);
    container.appendChild(card);
    // Enable material drag & drop inside this card
    initMaterialSortable(card, index);
  });
}

// Helper: get a display name for a material type
function getTypeDisplayName(type) {
  const map = {
    book: 'Books',
    pdf: 'PDFs',
    link: 'Links',
    recording: 'Class Recordings'
  };
  return map[type] || (type.charAt(0).toUpperCase() + type.slice(1) + 's');
}

// Helper: get an icon for a material type
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

  // Preferred order for types
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
    list.setAttribute('data-type', type); // store type for later

    items.forEach(item => {
      // Find global index for deletion
      const globalMaterialIndex = course.materials.findIndex(
        m => m.type === item.type && m.title === item.title && m.url === item.url
      );

      const li = document.createElement('li');
      li.className = `material-item ${item.type}`;

      const icon = getIconForType(item.type);

      li.innerHTML = `
        <span class="material-icon" title="Drag to reorder">${icon}</span>
        <a href="${item.url}" class="material-link" target="_blank" rel="noopener">${item.title}</a>
        <button class="delete-material" data-course="${courseIndex}" data-material="${globalMaterialIndex}">🗑️</button>
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
  addBtn.addEventListener('click', () => showAddMaterialForm(card, courseIndex));
  card.appendChild(addBtn);

  return card;
}

// Show form to add new material
function showAddMaterialForm(card, courseIndex) {
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

  document.getElementById('save-material').addEventListener('click', () => {
    const type = document.getElementById('mat-type').value;
    const title = document.getElementById('mat-title').value.trim();
    const url = document.getElementById('mat-url').value.trim();
    if (!title || !url) {
      alert('Please fill both title and URL.');
      return;
    }
    courses[courseIndex].materials.push({ type, title, url });
    saveCourses();
    renderCourses();
    initDragAndDrop(); // re‑init after re‑render
  });

  document.getElementById('cancel-material').addEventListener('click', () => {
    form.remove();
  });
}

// Add a new course
document.getElementById('addCourseBtn').addEventListener('click', () => {
  const code = prompt('Enter course code (e.g. MAT130):');
  if (!code) return;
  const name = prompt('Enter course name (e.g. Linear Algebra):');
  if (!name) return;

  courses.push({
    code,
    name,
    materials: []
  });
  saveCourses();
  renderCourses();
  initDragAndDrop();
});

// Delete material
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-material')) {
    const courseIdx = e.target.getAttribute('data-course');
    const materialIdx = e.target.getAttribute('data-material');
    if (courseIdx !== null && materialIdx !== null) {
      courses[courseIdx].materials.splice(materialIdx, 1);
      saveCourses();
      renderCourses();
      initDragAndDrop();
    }
  }
});

// --- Drag & Drop for COURSES (reorder cards) ---
function initDragAndDrop() {
  const container = document.getElementById('courseContainer');
  if (container.sortable) {
    container.sortable.destroy();
  }
  container.sortable = new Sortable(container, {
    animation: 250,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    onEnd: function() {
      const newOrder = [];
      const cards = container.querySelectorAll('.course-card');
      cards.forEach(card => {
        const code = card.getAttribute('data-course-code');
        const course = courses.find(c => c.code === code);
        if (course) newOrder.push(course);
      });
      if (newOrder.length === courses.length) {
        courses = newOrder;
        saveCourses();
      }
    }
  });
}

// --- Drag & Drop for MATERIALS (reorder items within each course) ---
function initMaterialSortable(card, courseIndex) {
  const lists = card.querySelectorAll('.material-list');
  lists.forEach(list => {
    // If already a Sortable instance, destroy it first
    if (list.sortable) {
      list.sortable.destroy();
    }
    list.sortable = new Sortable(list, {
      animation: 150,
      handle: '.material-icon',   // drag by the icon
      ghostClass: 'material-ghost',
      onEnd: function() {
        // Rebuild materials array for this course based on current DOM order
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
        saveCourses();
        // Re-render to keep delete button indices correct
        renderCourses();
        initDragAndDrop(); // re-init course drag after re-render
      }
    });
  });
}

// Optional: style for dragging materials
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