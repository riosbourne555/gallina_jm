const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight - 120;
}
resizeCanvas();

// --- SISTEMA DE PRECARGA ABSOLUTA DE IMÁGENES ---
const imagesToLoad = {};
const imageSources = {
    // Escenario
    bg: 'fondo_1.jpg',
    huevo: 'huevo.png',
    // Sprites Gallina
    parada: 'gallina_parada.png',
    subiendo: 'gallina_subiendo.png',
    bajando: 'gallina_bajando.png',
    doble: 'gallina_doble.png',
    choca: 'gallina_choca.png',
    // Obstáculos
    obs1: 'obstaculo_1.png',
    obs2: 'obstaculo_2.png',
    obs3: 'obstaculo_3.png',
    obs4: 'obstaculo_4.png',
    obs5: 'obstaculo_5.png'
};

// Promesa para garantizar que el navegador cargue todo antes de pintar
function loadAllImages() {
    const promises = Object.keys(imageSources).map(key => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = imageSources[key];
            img.onload = () => {
                imagesToLoad[key] = img;
                resolve();
            };
            img.onerror = () => {
                console.error("Fallo al cargar el recurso crítico: " + imageSources[key]);
                // Fallback: Creamos un canvas vacío para que no rompa el código si falta una foto
                const mockImg = new Image();
                imagesToLoad[key] = mockImg;
                resolve();
            };
        });
    });
    return Promise.all(promises);
}


// Variables Globales de Control
let score = 0;
let gameActive = false;
let gameSpeed = 5;
let baseSpeed = 5;
let obstacles = [];
let eggs = [];
let backgroundX = 0;
let lastTime = 0;

// Constantes Físicas
const GRAVITY = 0.6;
const MIN_JUMP_FORCE = -8;
const MAX_JUMP_FORCE = -15;
const JUMP_HOLD_ACCEL = -0.7;

const chicken = {
    x: 50, y: 0, width: 55, height: 55, vy: 0,
    isGrounded: false, jumpPressed: false, jumpTimer: 0,
    maxJumpTime: 12, doubleJumpUsed: false, state: 'parada'
};

const floorY = canvas.height - 40;
chicken.y = floorY - chicken.height;

// --- ESTRUCTURA DE MENÚS ---
const mainMenu = document.getElementById("main-menu-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const scoreBoard = document.getElementById("score-board");
const controlZone = document.getElementById("controls");

document.getElementById("start-btn").addEventListener("click", () => {
    mainMenu.classList.add("hidden");
    scoreBoard.classList.remove("hidden");
    controlZone.classList.remove("hidden");
    startGame();
});

document.getElementById("exit-btn").addEventListener("click", () => {
    alert("¡Gracias por jugar!");
});

document.getElementById("restart-btn").addEventListener("click", () => {
    gameOverScreen.classList.add("hidden");
    document.getElementById("restart-btn").classList.add("hidden");
    document.getElementById("score-registration").classList.remove("hidden");
    startGame();
});

document.getElementById("save-score-btn").addEventListener("click", saveScore);

function startGame() {
    score = 0;
    baseSpeed = 3.5;
    gameSpeed = baseSpeed;
    obstacles = [];
    eggs = [];
    backgroundX = 0; // Reiniciar posición del fondo
    chicken.y = floorY - chicken.height;
    chicken.vy = 0;
    chicken.isGrounded = true;
    chicken.state = 'parada';
    gameActive = true;
    lastTime = performance.now();
    loop(lastTime);
}

// --- CONTROLES DE ACCIÓN ---
const jumpBtn = document.getElementById("jump-btn");
function startJump(e) {
    e.preventDefault();
    if (!gameActive) return;
    if (chicken.isGrounded) {
        chicken.isGrounded = false;
        chicken.vy = MIN_JUMP_FORCE;
        chicken.jumpPressed = true;
        chicken.jumpTimer = 0;
        chicken.doubleJumpUsed = false;
    } else if (!chicken.doubleJumpUsed) {
        chicken.state = 'doble';
        chicken.doubleJumpUsed = true;

        const eggWidth = 22;
        const eggHeight = 28;
        const spawnX = chicken.x + (chicken.width / 2) - (eggWidth / 2);
        const spawnY = chicken.y + chicken.height;

        chicken.vy = MAX_JUMP_FORCE * 0.85; 
        
        eggs.push({ 
            x: spawnX, 
            y: spawnY, 
            width: eggWidth,
            height: eggHeight,
            vy: 1.8,  // Caída majestuosa y lenta
            vx: 0,    // Se queda fijo en su eje X cayendo recto
            angle: 0
        });
    }
}
function endJump(e) { e.preventDefault(); chicken.jumpPressed = false; }

jumpBtn.addEventListener("touchstart", startJump);
jumpBtn.addEventListener("touchend", endJump);
jumpBtn.addEventListener("mousedown", startJump);
jumpBtn.addEventListener("mouseup", endJump);

// --- DETECTOR DE OBSTÁCULOS ---
function spawnObstacle() {
    const obsKeys = ['obs1', 'obs2', 'obs3', 'obs4', 'obs5'];
    let randomKey = obsKeys[Math.floor(Math.random() * obsKeys.length)];
    const ASPECT_RATIO = 60 / 40;
    let height = 40 + score / 100 + Math.random() * 100;
    let width = height * ASPECT_RATIO;
    
    obstacles.push({
        x: canvas.width,
        y: floorY - height,
        width: width,
        height: height,
        imgKey: randomKey
    });
}

// --- ACTUALIZACIÓN DE LÓGICA ---
function update(deltaTime) {
    if (!gameActive) return;

    // 1. Los puntos se suman basados en segundos transcurridos (1 seg = 10 puntos)
    score += (deltaTime / 1000) * 10;
    document.getElementById("score").innerText = Math.floor(score);

    // 2. Escalado progresivo y lento de la velocidad (dividido por 450 para máxima suavidad)
    gameSpeed = baseSpeed + (score / 300);

    // 3. Movimiento lento de derecha a izquierda del fondo (efecto parallax sutil)
// 3. Movimiento lento del fondo con transición gradual y fluida (CORREGIDO)
    backgroundX -= gameSpeed * 0.1; 

    // Calculamos de nuevo el ancho escalado proporcional para saber el límite exacto
    const bgImgForUpdate = imagesToLoad['bg'];
    if (bgImgForUpdate && bgImgForUpdate.width > 0) {
        const aspectRatio = bgImgForUpdate.width / bgImgForUpdate.height;
        const scaledWidth = canvas.height * aspectRatio;

        // CORRECCIÓN CRÍTICA: En lugar de forzar a 0, aplicamos el operador residuo (modulo).
        // Esto absorbe cualquier exceso de píxeles del desplazamiento, haciendo el bucle 100% continuo.
        if (backgroundX <= -scaledWidth) {
            backgroundX = backgroundX % scaledWidth;
        }
    }

    // 4. Manejo físico del salto de altura variable
    if (chicken.jumpPressed && chicken.jumpTimer < chicken.maxJumpTime) {
        chicken.vy += JUMP_HOLD_ACCEL;
        chicken.jumpTimer++;
    }
    
    // Aplicar gravedad a la velocidad vertical
    chicken.vy += GRAVITY;
    chicken.y += chicken.vy;

    // 5. Cíclica y generación de obstáculos aleatorios
    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - (350 + Math.random() * 250)) {
        spawnObstacle();
    }

    // 6. PROCESAMIENTO DE OBSTÁCULOS CON MECÁNICA DE PLATAFORMA (PARKOUR)
    let standsOnPlatform = false;

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= gameSpeed;

        // Comprobación de colisión por cajas superpuestas (AABB)
        const isOverlapping = 
            chicken.x < obs.x + obs.width &&
            chicken.x + chicken.width > obs.x &&
            chicken.y < obs.y + obs.height &&
            chicken.y + chicken.height > obs.y;

        if (isOverlapping) {
            // Margen de tolerancia física para detectar si aterriza de forma limpia
            const platformTolerance = 12; 
            const overlapY = (chicken.y + chicken.height) - obs.y;

            // SI LA GALLINA CAE DESDE ARRIBA: Se convierte en plataforma sólida
            if (chicken.vy >= 0 && overlapY <= platformTolerance + chicken.vy) {
                chicken.y = obs.y - chicken.height;
                chicken.vy = 0;
                chicken.isGrounded = true;
                chicken.doubleJumpUsed = false; // ¡Recupera el doble salto al pararse encima!
                standsOnPlatform = true;
            } else {
                
                const margenTolerancia = 14; 

// CONTROL DE COLISIÓN FRONTAL (Con rango de seguridad)
                if (
                    chicken.x + chicken.width >= obs.x + margenTolerancia && // ¿El frente del personaje entró al obstáculo?
                    chicken.x <= obs.x + obs.width                         // ¿El personaje sigue dentro del ancho del obstáculo?
                ){
                    endGame();
                    return; // Detiene la ejecución del frame inmediatamente
                }
            }
        }

        // Eliminar el obstáculo si se sale del lienzo por el borde izquierdo
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    // 7. GESTIÓN DEL SUELO REAL Y CAÍDAS DE PLATAFORMAS
    if (chicken.y < floorY - chicken.height) {
        // Si está en el aire y no se ha apoyado en un obstáculo, sigue cayendo
        if (!standsOnPlatform) {
            chicken.isGrounded = false;
        }
    } else {
        // Si toca el suelo real de hierba
        chicken.y = floorY - chicken.height;
        chicken.vy = 0;
        chicken.isGrounded = true;
    }

    // 8. DETERMINACIÓN DEL ESTADO GRÁFICO (SPRITE) EN EL AIRE
    if (!chicken.isGrounded) {
        if (chicken.doubleJumpUsed && chicken.vy < 0) {
            chicken.state = 'doble';
        } else if (chicken.vy < 0) {
            chicken.state = 'subiendo';
        } else {
            chicken.state = 'bajando';
        }
    } else {
        chicken.state = 'parada';
    }

    // 9. PROCESAR Y MOVER HUEVOS LANZADOS
    for (let i = eggs.length - 1; i >= 0; i--) {
        eggs[i].y += eggs[i].vy;
        eggs[i].x += eggs[i].vx;
        eggs[i].angle += 0.05; // Rotación lenta y natural del huevo

        // Eliminación del proyectil cuando sale completamente por el fondo del canvas
        if (eggs[i].y > canvas.height) {
            eggs.splice(i, 1);
        }
    }
}

// --- DIBUJADO COMPLETO EN LIENZO ---
function draw() {
    // 1. Limpiar el lienzo por completo antes de pintar el nuevo fotograma
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Render del Fondo Proporcional e Infinito (Evita la compresión de imagen)
    const bgImg = imagesToLoad['bg'];
    if (bgImg && bgImg.width > 0) {
        // Calculamos la proporción nativa: cuánto ancho requiere según la altura disponible del canvas
        const aspectRatio = bgImg.width / bgImg.height;
        const scaledWidth = canvas.height * aspectRatio; 

        // Sincronizamos el reinicio del ciclo continuo con el ancho real escalado
        if (backgroundX <= -scaledWidth) {
            backgroundX = 0;
        }

        // Dibujamos el bloque principal y el bloque de relevo uno al lado del otro
        ctx.drawImage(bgImg, backgroundX, 0, scaledWidth, canvas.height);
        ctx.drawImage(bgImg, backgroundX + scaledWidth, 0, scaledWidth, canvas.height);
    } else {
        // Color azul plano de emergencia si el archivo 'background.png' experimenta retrasos
        ctx.fillStyle = "#87CEEB"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 3. Render del Piso Verde (Se superpone al fondo para delimitar el suelo base)
    ctx.fillStyle = "#228B22";
    ctx.fillRect(0, floorY, canvas.width, canvas.height - floorY);

    // 4. Render de los Huevos de Doble Salto (Con rotación e imagen 'huevo.png')
    const eggSprite = imagesToLoad['huevo'];
    eggs.forEach(egg => {
        if (eggSprite && eggSprite.width > 0) {
            ctx.save();
            // Desplazamos el punto de origen al centro del huevo para que el giro sea simétrico
            ctx.translate(egg.x + egg.width / 2, egg.y + egg.height / 2);
            ctx.rotate(egg.angle);
            // Dibujamos el sprite centrado respecto a ese nuevo origen (0, 0)
            ctx.drawImage(eggSprite, -egg.width / 2, -egg.height / 2, egg.width, egg.height);
            ctx.restore();
        } else {
            // Reemplazo geométrico ovalado si la textura no está disponible
            ctx.fillStyle = "#FFFDD0";
            ctx.fillRect(egg.x, egg.y, egg.width, egg.height);
        }
    });

    // 5. Render de Obstáculos Aleatorios de Parkour (Tamaño duplicado/triplicado)
    obstacles.forEach(obs => {
        const obsSprite = imagesToLoad[obs.imgKey];
        if (obsSprite && obsSprite.width > 0) {
            ctx.drawImage(obsSprite, obs.x, obs.y, obs.width, obs.height);
        } else {
            // Caja de advertencia de color rojo si las imágenes 'obstaculo_x.png' faltan
            ctx.fillStyle = "#ff4757";
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
    });

    // 6. Render del Personaje Principal (Gallina Azul) según su estado de movimiento
    const currentImg = imagesToLoad[chicken.state];
    if (currentImg && currentImg.width > 0) {
        ctx.drawImage(currentImg, chicken.x, chicken.y, chicken.width, chicken.height);
    } else {
        // Respaldo de color en caso de que ocurra una falla con los sprites de la gallina
        ctx.fillStyle = chicken.state === 'choca' ? 'red' : '#1e90ff';
        ctx.fillRect(chicken.x, chicken.y, chicken.width, chicken.height);
    }
}


// --- BUCLE DE ANIMACIÓN COHERENTE ---
function loop(timestamp) {
    if (!gameActive) return;
    if (!lastTime) lastTime = timestamp;
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    draw();
    requestAnimationFrame(loop);
}


function endGame() {
    gameActive = false;
    chicken.state = 'choca';
    draw();
    document.getElementById("final-score").innerText = Math.floor(score);
    displayLeaderboard();
    gameOverScreen.classList.remove("hidden");
}

// --- SISTEMA DE RANKING LOCAL (STORAGE) ---
function saveScore() {
    const nameInput = document.getElementById("player-name");
    const name = nameInput.value.trim() || "Anónimo";
    const finalPoints = Math.floor(score);

    let highScores = JSON.parse(localStorage.getItem("parkour_scores")) || [];
    highScores.push({ name: name, score: finalPoints });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5); // Guardar solo el Top 5

    localStorage.setItem("parkour_scores", JSON.stringify(highScores));
    nameInput.value = "";
    
    document.getElementById("score-registration").classList.add("hidden");
    document.getElementById("restart-btn").classList.remove("hidden");
    displayLeaderboard();
}

function displayLeaderboard() {
    const listContainer = document.getElementById("leaderboard-list");
    listContainer.innerHTML = "";
    const highScores = JSON.parse(localStorage.getItem("parkour_scores")) || [];

    highScores.forEach(item => {
        let li = document.createElement("li");
        li.innerHTML = `<strong>${item.name}</strong> - ${item.score} pts`;
        listContainer.appendChild(li);
    });
}

loadAllImages().then(() => {
    console.log("¡Todos los elementos gráficos se integraron con éxito!");
    draw(); 
});

