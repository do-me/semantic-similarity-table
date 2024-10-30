import { AutoModel, AutoTokenizer, Tensor } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.1';

// Additional checkboxes for column selection
const maxSimCheckbox = document.getElementById('maxSimCheckbox');
const meanSimCheckbox = document.getElementById('meanSimCheckbox');
const maxSimChunkCheckbox = document.getElementById('maxSimChunkCheckbox');
const chunksCheckbox = document.getElementById('chunksCheckbox');
const embeddingsCheckbox = document.getElementById('embeddingsCheckbox')


let fileExtension = '';
// Theme management
const themeSelect = document.getElementById('themeSelect');

// Function to set theme
function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
    } else if (theme === 'system') {
        // Check system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
    // Save preference
    localStorage.setItem('theme', theme);
}

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'system';
themeSelect.value = savedTheme;
setTheme(savedTheme);

// Listen for theme changes
themeSelect.addEventListener('change', (e) => setTheme(e.target.value));

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (themeSelect.value === 'system') {
        setTheme('system');
    }
});


///////////////////////////////////

class TextSplitter {
    constructor({
        chunkSize = 4000,
        lengthFunction = (text) => text.length,
        keepSeparator = false,
    } = {}) {
        this.chunkSize = chunkSize;
        this.lengthFunction = lengthFunction;
        this.keepSeparator = keepSeparator;
    }

    splitText(text) {
        throw new Error("Method 'splitText' should be implemented.");
    }

    _joinDocs(docs, separator) {
        return docs.join(separator).trim() || null;
    }

    _mergeSplits(splits, separator) {
        let docs = [], currentDoc = [], total = 0;
        const separatorLen = this.lengthFunction(separator);

        splits.forEach(d => {
            const len = this.lengthFunction(d);
            if (total + len + (currentDoc.length ? separatorLen : 0) > this.chunkSize) {
                docs.push(this._joinDocs(currentDoc, separator));
                currentDoc = [];
                total = 0;
            }
            currentDoc.push(d);
            total += len + (currentDoc.length > 1 ? separatorLen : 0);
        });

        const finalDoc = this._joinDocs(currentDoc, separator);
        if (finalDoc) docs.push(finalDoc);
        return docs;
    }
}

const splitTextWithRegex = (text, separator, keepSeparator) => {
    const splits = separator
        ? text.split(new RegExp(keepSeparator ? `(${separator})` : separator))
        : [...text];

    return splits.filter(Boolean);
};

class RecursiveCharacterTextSplitter extends TextSplitter {
    constructor({
        separators = [],
        keepSeparator = true,
        isSeparatorRegex = false,
        ...rest
    } = {}) {
        super({ keepSeparator, ...rest });
        this.separators = separators;
        this.isSeparatorRegex = isSeparatorRegex;
    }

    _splitText(text, separators) {
        let finalChunks = [], goodSplits = [];
        const separator = this._getSeparator(text, separators);
        const finalSeparator = this.keepSeparator ? "" : separator;
        const splits = splitTextWithRegex(text, this._escapeRegex(separator), this.keepSeparator);
        const newSeparators = separators.slice(separators.indexOf(separator) + 1);

        splits.forEach(s => {
            if (this.lengthFunction(s) < this.chunkSize) {
                goodSplits.push(s);
            } else {
                if (goodSplits.length) {
                    finalChunks.push(...this._mergeSplits(goodSplits, finalSeparator));
                    goodSplits = [];
                }
                finalChunks.push(...(newSeparators.length ? this._splitText(s, newSeparators) : [s]));
            }
        });

        if (goodSplits.length) finalChunks.push(...this._mergeSplits(goodSplits, finalSeparator));
        return finalChunks;
    }

    _getSeparator(text, separators) {
        for (const sep of separators) {
            const escapedSep = this.isSeparatorRegex ? sep : this._escapeRegex(sep);
            if (new RegExp(escapedSep).test(text)) return sep;
        }
        return separators[separators.length - 1];
    }

    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    splitText(text) {
        return this._splitText(text, this.separators);
    }
}


function chunkText(text, chunkSize = 600, separators = ["\n\n", "\n", ".", "?", "!", ";", ",", ":", " ", ""]) {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        separators,
        keepSeparator: true, // Or false, depending on your needs
    });
    return splitter.splitText(text);
}

////////////////////////////////////


// Drag & Drop Handlers
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const columnSettings = document.getElementById('columnSettings');
const processButton = document.getElementById('processButton');
const status = document.getElementById('status');
const statusMessage = document.getElementById('statusMessage');

let workbook = null;
let fileName = '';
let jsonData = null;

dropZone.addEventListener('dragover', e => e.preventDefault());
dropZone.addEventListener('dragleave', e => dropZone.classList.remove('border-blue-500'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500');
    handleFile(e.dataTransfer.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

async function handleFile(file) {
    fileName = file.name;
    fileExtension = fileName.split('.').pop().toLowerCase();

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);

            if (fileExtension === 'csv') {
                const csvText = new TextDecoder('utf-8').decode(data);
                workbook = XLSX.read(csvText, { type: 'string' });
            } else {
                workbook = XLSX.read(data, { type: 'array' });
            }
            columnSettings.classList.remove('hidden');
            showStatus('File loaded successfully!', 'success');
        } catch {
            showStatus('Error reading file. Please upload a valid Excel or CSV file.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

async function processFile() {
    try {
        const columnName = document.getElementById('columnName').value.trim();
        const queryText = document.getElementById('queryText').value.trim();

        if (!workbook || !columnName || !queryText) {
            showStatus('Please upload a file and fill all fields.', 'error');
            return;
        }

        showStatus('Processing file...', 'success');

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(sheet);

        // Load model and tokenizer
        const model = await AutoModel.from_pretrained('minishlab/M2V_base_output', { revision: 'refs/pr/1' });
        const tokenizer = await AutoTokenizer.from_pretrained('minishlab/M2V_base_output', { revision: 'refs/pr/2' });

        const queryEmbedding = await getEmbedding(queryText, tokenizer, model);
        //console.log("Query embeddings:", queryEmbedding);

        let chunkEmbeddings = [];

        // Process each row sequentially
        for (const row of jsonData) {
            const chunks = chunkText(row[columnName]);
            console.log("Number of chunks: ", chunks.length);

            let maxSimilarity = -Infinity;
            let maxSimilarityChunk = '';
            let similaritySum = 0;

            // Process each chunk sequentially
            for (const chunk of chunks) {
                //console.log(chunk.length)
                if (chunk.length > 32000) { console.log(row) }
                try {
                    const chunkEmbedding = await getEmbedding(chunk, tokenizer, model);
                    //console.log("Chunk embedding:", chunkEmbedding);

                    if (chunkEmbedding && queryEmbedding) {
                        const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
                        similaritySum += similarity;

                        if (similarity > maxSimilarity) {
                            maxSimilarity = similarity;
                            maxSimilarityChunk = chunk;
                        }

                        // If embeddings checkbox is checked, store the chunk embedding
                        if (embeddingsCheckbox.checked) {
                            chunkEmbeddings.push(chunkEmbedding);
                        }
                    }
                } catch (error) {
                    console.error(`Error processing chunk: ${chunk}`, error, row);
                }
            }

            // Update row with results, dynamically adding queryText to the column names
            // Conditionally add columns based on checkbox selection
            if (maxSimCheckbox.checked) {
                row[`max_sim ${queryText}`] = maxSimilarity;
            }

            if (meanSimCheckbox.checked) {
                row[`mean_sim ${queryText}`] = chunks.length > 0 ? similaritySum / chunks.length : 0;
            }
            if (maxSimChunkCheckbox.checked) {
                row[`max_sim chunk_${queryText}`] = maxSimilarityChunk;
            }
            if (chunksCheckbox.checked) {
                row[`chunks ${queryText}`] = chunks.length;
            }
            
            if (embeddingsCheckbox.checked) {
                console.log(chunkEmbeddings)
                row[`embeddings ${queryText}`] = JSON.stringify(chunkEmbeddings);
            }
        }

        const newSheet = XLSX.utils.json_to_sheet(jsonData);
        workbook.Sheets[workbook.SheetNames[0]] = newSheet;

        let blob, mimeType, downloadExtension;
        if (fileExtension === 'csv') {
            const csvOutput = XLSX.utils.sheet_to_csv(newSheet);
            blob = new Blob([csvOutput], { type: 'text/csv' });
            mimeType = 'text/csv';
            downloadExtension = 'csv';
        } else {
            const xlsxOutput = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            blob = new Blob([xlsxOutput], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            downloadExtension = 'xlsx';
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `modified_${fileName.replace(/\.[^/.]+$/, '')}.${downloadExtension}`;
        a.click();
        window.URL.revokeObjectURL(url);

        showStatus('File processed and downloaded successfully! You can add another query by simply hitting "Process File" again.', 'success');
    } catch (error) {
        console.error('Error processing file:', error);
        showStatus('Error processing file. Please check console for details.', 'error');
    }
}
// Cosine similarity calculation
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Embedding helper
async function getEmbedding(text, tokenizer, model) {
    try {
        if (!text || typeof text !== 'string') {
            console.error('Invalid text input:', text);
            return null;
        }

        const texts = [text]; // Handle single text input as an array
        //console.log('Tokenizing text:', texts);

        const tokenized = await tokenizer(texts, {
            add_special_tokens: false,
            return_tensor: false
        });
        //console.log('Tokenized result:', tokenized);

        if (!tokenized.input_ids || !tokenized.input_ids.length) {
            console.error('Tokenization failed');
            return null;
        }

        // Compute offsets using cumulative sum approach
        const cumsum = arr => arr.reduce((acc, num, i) => [...acc, num + (acc[i - 1] || 0)], []);
        const offsets = [0, ...cumsum(tokenized.input_ids.slice(0, -1).map(x => x.length))];

        // Flatten input IDs for model input
        const flattened_input_ids = tokenized.input_ids.flat();

        // Prepare model inputs with flattened IDs and calculated offsets
        const model_inputs = {
            input_ids: new Tensor('int64', flattened_input_ids, [flattened_input_ids.length]),
            offsets: new Tensor('int64', offsets, [offsets.length]),
        };

        //console.log('Model inputs:', model_inputs);

        // Get embeddings from model
        const { embeddings } = await model(model_inputs);
        const embeddings_list = embeddings.tolist()[0];
        //console.log('Generated embeddings:', embeddings_list);

        return embeddings_list;
    } catch (error) {
        console.error('Error in getEmbedding:', error);
        return null;
    }
}

processButton.addEventListener('click', processFile);

function showStatus(message, type) {
    status.classList.remove('hidden');
    statusMessage.textContent = message;
    if (type === 'error') {
        status.classList.replace('bg-green-50', 'bg-red-50');
        statusMessage.classList.replace('text-green-800', 'text-red-800');
    } else {
        status.classList.replace('bg-red-50', 'bg-green-50');
        statusMessage.classList.replace('text-red-800', 'text-green-800');
    }
}