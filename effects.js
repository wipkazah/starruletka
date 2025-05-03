function showConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    document.body.appendChild(canvas);
    
    const confetti = new Confetti(canvas);
    confetti.fire({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
    });
    
    setTimeout(() => canvas.remove(), 3000);
}