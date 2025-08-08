let selectedFilePath = null;
let modFolder = null;

window.addEventListener('DOMContentLoaded', async () => {
  // Custom title bar controls
  document.getElementById('minimize-btn').onclick = () => window.electronAPI.minimizeWindow();
  document.getElementById('close-btn').onclick = () => window.electronAPI.closeWindow();

  const selectModFolderBtn = document.getElementById('select-mod-folder-btn');
  const modFolderPathDiv = document.getElementById('mod-folder-path');
  const platformCodeSelect = document.getElementById('platform-code');

  // Load settings and main manager platform code
  let settings = await window.electronAPI.loadSettings();
  if (!settings.modFolder) {
    modFolderPathDiv.textContent = 'No mod folder selected.';
  } else {
    modFolder = settings.modFolder;
    modFolderPathDiv.textContent = modFolder;
  }
  // Try to load main mod manager platform code
  let mainSettings = await window.electronAPI.loadMainManagerSettings();
  if (mainSettings && mainSettings.platform) {
    let code = 'Windows';
    if (mainSettings.platform.toLowerCase().includes('epic')) code = 'EGS';
    else if (mainSettings.platform.toLowerCase().includes('microsoft')) code = 'WinGDK';
    else if (mainSettings.platform.toLowerCase().includes('steam')) code = 'Windows';
    platformCodeSelect.value = code;
  }

  selectModFolderBtn.onclick = async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      modFolder = folder;
      modFolderPathDiv.textContent = modFolder;
      await window.electronAPI.saveSettings({ modFolder });
    }
  };

  // Drag and drop logic
  const dropArea = document.getElementById('drop-area');
  const dropText = document.getElementById('drop-text');
  const fileNameDiv = document.getElementById('file-name');
  const form = document.getElementById('metadata-form');
  const resultMessage = document.getElementById('result-message');
  const moreFeaturesBtn = document.getElementById('more-features-btn');
  const moreOptionsModal = document.getElementById('more-options-modal');
  const closeMoreOptionsBtn = document.getElementById('close-more-options');
  const moreOptionsForm = document.getElementById('more-options-form');
  const conversorResult = document.getElementById('conversor-result');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove('dragover');
    });
  });
  dropArea.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith('.mmpackage')) {
      dropText.textContent = 'Please drop a .mmpackage file.';
      fileNameDiv.textContent = '';
      form.classList.add('hidden');
      return;
    }
    selectedFilePath = file.path;
    fileNameDiv.textContent = file.name;
    dropText.textContent = 'File selected:';
    form.classList.remove('hidden');
    resultMessage.textContent = '';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!selectedFilePath) return;
    const metadata = {
      name: document.getElementById('mod-name').value.trim(),
      author: document.getElementById('author').value.trim(),
      description: document.getElementById('description').value.trim(),
      category: document.getElementById('mod-type').value
    };
    resultMessage.textContent = 'Injecting metadata...';
    resultMessage.className = '';
    const res = await window.electronAPI.injectMetadata(selectedFilePath, metadata);
    if (res.success) {
      resultMessage.textContent = 'metadata.json injected successfully!';
      resultMessage.className = 'success';
    } else {
      resultMessage.textContent = 'Error: ' + res.error;
      resultMessage.className = 'error';
    }
  });

  // More Features Modal
  moreFeaturesBtn.onclick = () => {
    moreOptionsModal.classList.remove('hidden');
    conversorResult.textContent = '';
  };
  closeMoreOptionsBtn.onclick = () => {
    moreOptionsModal.classList.add('hidden');
  };

  // Conversor logic in More Features
  moreOptionsForm.onsubmit = async e => {
    e.preventDefault();
    if (!modFolder) {
      conversorResult.textContent = 'Please select a mod folder first.';
      conversorResult.className = 'error';
      return;
    }
    const filesInput = document.getElementById('conversor-files');
    const files = Array.from(filesInput.files);
    if (files.length !== 4) {
      conversorResult.textContent = 'Please select exactly 4 files (.pak, .sig, .ucas, .utoc).';
      conversorResult.className = 'error';
      return;
    }
    const platformCode = platformCodeSelect.value;
    const customNumber = document.getElementById('custom-number').value.trim();
    const customPackageName = document.getElementById('custom-package-name').value.trim();
    const res = await window.electronAPI.conversorCreateMmpackage({
      files: files.map(f => ({ name: f.name, path: f.path })),
      platformCode,
      customNumber,
      modFolder,
      customPackageName
    });
    if (res.success) {
      conversorResult.textContent = `Converted to .mmpackage in your mod folder.`;
      conversorResult.className = 'success';
    } else {
      conversorResult.textContent = 'Error: ' + res.error;
      conversorResult.className = 'error';
    }
  };
});
