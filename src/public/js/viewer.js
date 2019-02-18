
class WebVRDisplayDriver
{
    constructor({display, canvas})
    {
        this.display = display;
        this.canvas = canvas;
    }

    async requestPresent()
    {
        this.display.requestPresent([{ source: this.canvas }]);
    }
}

class Viewer
{
    constructor(canvas)
    {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
    }
}

async function selectVRDiplay()
{
    if (!navigator.getVRDisplays)
    {
        throw new Error('WebVR 1.1 is not supported');
    }
    const displays = await navigator.getVRDisplays();
    const display = displays[0];
    display.requestPresent
}

function startViewer(canvas)
{
    try
    {
        const viewer = new Viewer(canvas);
    }
    catch (err)
    {
        alert("failed to start viewer:\n" + err && err.stack || err);
    }
}
