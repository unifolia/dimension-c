import "./style.css";

class DimensionChorus {
  private audioContext: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private delays: DelayNode[] = [];
  private lfos: OscillatorNode[] = [];
  private lfoGains: GainNode[] = [];
  private activeModes: Set<number> = new Set([1]);

  constructor() {
    this.audioContext = new AudioContext();
    this.inputNode = this.audioContext.createGain();
    this.outputNode = this.audioContext.createGain();
    this.dryGain = this.audioContext.createGain();
    this.wetGain = this.audioContext.createGain();
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);
    this.setupChorusVoices();
    this.updateAudio();
  }

  private setupChorusVoices(): void {
    const numVoices = 4;

    for (let i = 0; i < numVoices; i++) {
      const delay = this.audioContext.createDelay(0.1);
      delay.delayTime.value = 0.005 + i * 0.002;

      const lfoGain = this.audioContext.createGain();
      lfoGain.gain.value = 0.002;

      const lfo = this.audioContext.createOscillator();
      lfo.frequency.value = 0.5 + i * 0.13;
      lfo.type = "sine";

      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);

      this.inputNode.connect(delay);
      delay.connect(this.wetGain);

      this.delays.push(delay);
      this.lfos.push(lfo);
      this.lfoGains.push(lfoGain);

      lfo.start();
    }

    this.wetGain.connect(this.outputNode);
  }

  public toggleMode(mode: number): void {
    if (mode === 0) {
      this.activeModes.clear();
    } else {
      if (this.activeModes.has(mode)) {
        this.activeModes.delete(mode);
      } else {
        if (this.activeModes.size >= 2) {
          const firstMode = Array.from(this.activeModes)[0];
          this.activeModes.delete(firstMode);
        }
        this.activeModes.add(mode);
      }
      this.activeModes.delete(0);
    }

    this.updateAudio();
  }

  private updateAudio(): void {
    let config;

    // idk man 🤷‍♂️
    const modeConfigs = [
      { wet: 0.0, dry: 1.0, depths: [0, 0, 0, 0] },
      { wet: 0.3, dry: 0.85, depths: [0.001, 0, 0, 0] },
      { wet: 0.4, dry: 0.8, depths: [0.0015, 0.0012, 0, 0] },
      { wet: 0.5, dry: 0.75, depths: [0.002, 0.0018, 0.0015, 0] },
      { wet: 0.6, dry: 0.7, depths: [0.0025, 0.002, 0.0018, 0.0015] },
    ];

    if (this.activeModes.size === 0) {
      config = modeConfigs[0];
    } else if (this.activeModes.size === 1) {
      const mode = Array.from(this.activeModes)[0];
      config = modeConfigs[mode];
    } else {
      const modes = Array.from(this.activeModes);
      const config1 = modeConfigs[modes[0]];
      const config2 = modeConfigs[modes[1]];

      config = {
        wet: (config1.wet + config2.wet) / 2,
        dry: (config1.dry + config2.dry) / 2,
        depths: config1.depths.map((d, i) => (d + config2.depths[i]) / 2),
      };
    }

    this.dryGain.gain.setTargetAtTime(
      config.dry,
      this.audioContext.currentTime,
      0.01
    );
    this.wetGain.gain.setTargetAtTime(
      config.wet,
      this.audioContext.currentTime,
      0.01
    );

    config.depths.forEach((depth, i) => {
      if (this.lfoGains[i]) {
        this.lfoGains[i].gain.setTargetAtTime(
          depth,
          this.audioContext.currentTime,
          0.01
        );
      }
    });
  }

  public async connect(source: MediaStreamAudioSourceNode): Promise<void> {
    source.connect(this.inputNode);
    this.outputNode.connect(this.audioContext.destination);
  }

  public getContext(): AudioContext {
    return this.audioContext;
  }

  public getActiveModes(): Set<number> {
    return this.activeModes;
  }
}

async function initAudio() {
  const chorus = new DimensionChorus();

  const stream = await navigator.mediaDevices.getUserMedia({
    // This sucks without these options disabled
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });

  const source = chorus.getContext().createMediaStreamSource(stream);
  await chorus.connect(source);

  const buttons = document.querySelectorAll(".mode-button");
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => {
      chorus.toggleMode(index);

      const activeModes = chorus.getActiveModes();

      buttons.forEach((b, i) => {
        if (i === 0) {
          b.classList.toggle("active", activeModes.size === 0);
        } else {
          b.classList.toggle("active", activeModes.has(i));
        }
      });
    });
  });

  document
    .querySelector('.mode-button[data-mode="1"]')
    ?.classList.add("active");
}

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="pedal-container">
    <div class="pedal">
      <h1 class="pedal-title">DIMENSION C</h1>
      <div class="pedal-subtitle">"I CAN believe it's not Boss!"</div>

      <div class="mode-selector">
        <div class="mode-label">MODE</div>
        <div class="mode-buttons">
          <button class="mode-button" data-mode="0">OFF</button>
          <button class="mode-button" data-mode="1"><span>1</span></button>
          <button class="mode-button" data-mode="2"><span>2</span></button>
          <button class="mode-button" data-mode="3"><span>3</span></button>
          <button class="mode-button" data-mode="4"><span>4</span></button>
        </div>
      </div>

      <div class="controls">
        <button id="start" class="start-button">酷 Start</button>
      </div>
    </div>
  </div>
  <p class="info">Please make sure that your browser has the necessary permissions ☔️</p>
`;

const startButton = document.querySelector<HTMLButtonElement>("#start")!;
startButton.addEventListener("click", async () => {
  try {
    await initAudio();
    startButton.disabled = true;
  } catch (error) {
    console.error("Something is broken:", error);
  }
});
