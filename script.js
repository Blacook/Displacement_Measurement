const imageInput = document.getElementById('imageInput');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');

let points = []; // 6 points on the image
let cachedImageData = null;
let currentImageSrc = null;
let conversionRate = null;
let knownPoints = []; // two points on the edge of the known object

imageInput.addEventListener('change', handleImageChange);
canvas.addEventListener('click', handleCanvasClick);
document.getElementById('resetButton').addEventListener('click', handleResetClick);

async function handleImageChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // If file is HEIC format, use heic2any for conversion
    if (file.type === "image/heic") {
        const convertedBlob = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.8
        });
        const reader = new FileReader();
        reader.onload = function(e) {
            displayImageOnCanvas(e.target.result);
        };
        reader.readAsDataURL(convertedBlob);
    } else {
        // For all other formats, load the image and draw on canvas
        const img = new Image();
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const jpegDataURL = canvas.toDataURL('image/jpeg', 0.8);
                displayImageOnCanvas(jpegDataURL);
            };
        };
        reader.readAsDataURL(file);
    }
}

function convertToJPEG(fileBlob) {
    return new Promise((resolve, reject) => {
        heic2any({
            blob: fileBlob,
            toType: "image/jpeg",
            quality: 0.9
        })
        .then(jpegBlob => {
            resolve(jpegBlob);
        })
        .catch(error => {
            reject(error);
        });
    });
}

function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // キャリブレーションがまだ済んでいない場合
    if (conversionRate === null) {
        if (knownPoints.length >= 2) return;  // 既に2点取得している場合は新たに点を打たない

        knownPoints.push({ x, y });
        plotPoint(x, y, "blue");  // 青色の点をプロット

        if (knownPoints.length == 2) {
            const pixelDistance = vectorLength(vectorSubtraction(knownPoints[0], knownPoints[1]));
            const knownObjectLength = parseFloat(document.getElementById('knownObjectLength').value);
            conversionRate = knownObjectLength / pixelDistance;
            alert("変換率が設定されました。\n Conversion rate has been set.");
        }
        return;
    } 

    // キャリブレーションが済んでいる場合、6点までしか打たないようにする
    if (points.length >= 6) return;

    points.push({ x, y });
    plotPoint(x, y);

    if (points.length === 6) {
        computeDisplacementAndRotation();
    }
}


function handleResetClick() {
    points = []; // 6 points on the image
    conversionRate = null;
    knownPoints = []; // two points on the edge of the known object

    // Restore the original image from cached data
    if (cachedImageData) {
        ctx.putImageData(cachedImageData, 0, 0);
    }

    document.getElementById('displacementResult').textContent = "-";
    document.getElementById('rotationResult').textContent = "-";
}

document.getElementById('toggleDescription').addEventListener('click', function() {
    const descriptionElement = document.getElementById('description');
    if (descriptionElement.style.display === "none") {
        descriptionElement.style.display = "block";
        this.textContent = "hide description";
    } else {
        descriptionElement.style.display = "none";
        this.textContent = "show description";
    }
});

function displayImageOnCanvas(src) {
    const img = new Image();
    img.onload = function() {
        const aspectRatio = img.width / img.height;
        let newWidth = canvas.width;
        let newHeight = newWidth / aspectRatio;

        if (newHeight > canvas.height) {
            newHeight = canvas.height;
            newWidth = newHeight * aspectRatio;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Cache the drawn image data
        cachedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    };
    img.src = src;
}

function plotPoint(x, y, color = "red") {
    ctx.fillStyle = color;
    ctx.fillRect(x-3, y-3, 6, 6);
}

function vectorSubtraction(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

function vectorLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
}

function vectorNormalization(v) {
    let length = vectorLength(v);
    return { x: v.x / length, y: v.y / length };
}

function angleBetweenVectors(v1, v2) {
    let dot = dotProduct(vectorNormalization(v1), vectorNormalization(v2));
    return Math.acos(Math.min(Math.max(dot, -1), 1));
}

function computeDisplacementAndRotation() {
    const translationDisplacement = vectorLength(vectorSubtraction(points[0], points[3]));
    const translationDisplacementCm = translationDisplacement * conversionRate;

    const edge1_marking = vectorSubtraction(points[1], points[0]);
    const edge2_marking = vectorSubtraction(points[2], points[0]);
    const edge1_ruler = vectorSubtraction(points[4], points[3]);
    const edge2_ruler = vectorSubtraction(points[5], points[3]);

    const angle1 = angleBetweenVectors(edge1_marking, edge1_ruler);
    const angle2 = angleBetweenVectors(edge2_marking, edge2_ruler);
    const rotationDisplacement = (angle1 + angle2) / 2;

    document.getElementById('displacementResult').textContent = translationDisplacementCm.toFixed(1) + " cm";
    document.getElementById('rotationResult').textContent = (rotationDisplacement * (180/Math.PI)).toFixed(1) + " deg";
}

