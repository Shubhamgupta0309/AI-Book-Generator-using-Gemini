// API configuration
const headers = {
    'Content-Type': 'application/json'
};

// DOM elements
const conceptInput = document.getElementById('concept');
const conceptButton = document.getElementById('conceptButton');
const contentsInput = document.getElementById('contents');
const contentButton = document.getElementById('contentButton');
const chaptersDiv = document.getElementById('chapters');
const chaptersButton = document.getElementById('chaptersButton');
const autoGenCheckbox = document.getElementById('auto-gen');
const exportPDFButton = document.getElementById('exportPDFButton');

// Global variables
let tableOfContents = [];
let currentLine = 0;
let isGenerating = false;

// Helper function to remove all asterisks
function cleanContent(text) {
    return text.replace(/\*/g, '');
}

// Helper function to show loading state
function setLoading(element, loading) {
    if (loading) {
        element.closest('.card-body').classList.add('loading');
    } else {
        element.closest('.card-body').classList.remove('loading');
    }
}

// Generate content using Gemini API
async function generateContent(role, prompt) {
    const fullPrompt = `${role}\n\n${prompt}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response format from API');
        }

        return cleanContent(data.candidates[0].content.parts[0].text);
    } catch (error) {
        console.error("Error fetching content:", error);
        throw new Error("Failed to generate content. Please try again.");
    }
}

// Other helper functions
function disableElements(elements) {
    elements.forEach(element => {
        if (element) element.disabled = true;
    });
}

function enableElements(elements) {
    elements.forEach(element => {
        if (element) element.disabled = false;
    });
}

function getInputValues() {
    return {
        gptRole: document.getElementById('gpt-role').value,
        bookLength: document.getElementById('book-length').value,
        genre: document.getElementById('genre').value,
        keywords: document.getElementById('keywords').value.split(',').map(k => k.trim()).filter(k => k)
    };
}

// Event listeners for button actions
conceptButton.addEventListener('click', async () => {
    try {
        setLoading(conceptInput, true);
        const { gptRole, bookLength, genre, keywords } = getInputValues();
        
        if (keywords.length === 0) {
            throw new Error('Please enter at least one keyword');
        }

        const prompt = `Generate a ${bookLength}-word ${genre} concept with keywords: ${keywords.join(', ')}.`;
        conceptInput.value = await generateContent(gptRole, prompt);
    } catch (error) {
        alert(error.message);
    } finally {
        setLoading(conceptInput, false);
    }
});

contentButton.addEventListener('click', async () => {
    try {
        if (!conceptInput.value.trim()) {
            throw new Error('Please generate a concept first');
        }

        setLoading(contentsInput, true);
        const { gptRole, genre, keywords } = getInputValues();
        disableElements([conceptInput, conceptButton]);

        const prompt = `Based on the ${genre} concept: "${conceptInput.value}" with keywords: ${keywords.join(', ')}, generate a table of contents. Only a list of chapter names with a short description.`;
        contentsInput.value = await generateContent(gptRole, prompt);
    } catch (error) {
        alert(error.message);
        enableElements([conceptInput, conceptButton]);
    } finally {
        setLoading(contentsInput, false);
    }
});

chaptersButton.addEventListener('click', async () => {
    try {
        if (!contentsInput.value.trim()) {
            throw new Error('Please generate table of contents first');
        }

        if (isGenerating) {
            return;
        }

        isGenerating = true;
        setLoading(chaptersDiv, true);
        const { gptRole, genre, keywords } = getInputValues();
        disableElements([conceptInput, contentsInput, conceptButton, contentButton]);

        if (!tableOfContents.length) {
            tableOfContents = contentsInput.value.split('\n').filter(line => line.trim());
        }

        if (currentLine < tableOfContents.length) {
            const prompt = `Based on the ${genre} chapter title: "${tableOfContents[currentLine]}" with keywords: ${keywords.join(', ')}, generate the chapter content.`;
            let chapterContent = await generateContent(gptRole, prompt);
            chapterContent = cleanContent(chapterContent.replace(/\n/g, '<br/>'));

            chaptersDiv.innerHTML += `<h2>${tableOfContents[currentLine]}</h2><p>${chapterContent}</p>`;
            currentLine++;

            if (autoGenCheckbox.checked && currentLine < tableOfContents.length) {
                setTimeout(() => chaptersButton.click(), 1000);
            }
        }
    } catch (error) {
        alert(error.message);
        enableElements([conceptInput, contentsInput, conceptButton, contentButton]);
    } finally {
        isGenerating = false;
        setLoading(chaptersDiv, false);
    }
});

// Export as PDF
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const content = chaptersDiv.innerHTML.replace(/\*/g, '');
    const sections = content.split(/<h2[^>]*>/);
    
    let yPos = 20;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 7;
    
    sections.forEach(section => {
        if (!section.trim()) return;
        const [title, ...contentParts] = section.split('</h2>');
        const content = contentParts.join('</h2>').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, '').trim();
        
        if (title) {
            if (yPos > pageHeight - margin) {
                pdf.addPage();
                yPos = 20;
            }
            
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(14);
            pdf.text(title.trim(), margin, yPos);
            yPos += lineHeight * 1;
        }
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        const lines = content.split('\n');
        lines.forEach(line => {
            const splitLines = pdf.splitTextToSize(line.trim(), pdf.internal.pageSize.width - (margin * 2));
            splitLines.forEach(splitLine => {
                if (yPos > pageHeight - margin) {
                    pdf.addPage();
                    yPos = 20;
                }
                pdf.text(splitLine, margin, yPos);
                yPos += lineHeight;
            });
            yPos += lineHeight / 2;
        });
        yPos += lineHeight * 2;
    });
    
    pdf.save('book.pdf');
}

if (exportPDFButton) exportPDFButton.addEventListener('click', exportToPDF);
