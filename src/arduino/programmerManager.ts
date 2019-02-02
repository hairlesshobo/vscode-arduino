import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as constants from "../common/constants";
import * as util from "../common/util";
import { DeviceContext } from "../deviceContext";
import { SerialMonitor } from "../serialmonitor/serialMonitor"
import { ArduinoApp } from "./arduino";
import { IArduinoSettings } from "./arduinoSettings";

export class ProgrammerManager {

    private static _programmerManager: ProgrammerManager = null;

    private _currentProgrammerName: string;

    private _programmerStatusBar: vscode.StatusBarItem;

    private _uploadPortsStatusBar: vscode.StatusBarItem;

    private _programmers: Map<string, string>;

    constructor(private _settings: IArduinoSettings, private _arduinoApp: ArduinoApp) {
        this._programmerStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, constants.statusBarPriority.PROGRAMMER);
        this._programmerStatusBar.command = "arduino.selectProgrammer";
        this._programmerStatusBar.tooltip = "Select Programmer";
        this._programmerStatusBar.text = "<Select Programmer>";
        this._programmerStatusBar.show();

        
        this._uploadPortsStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, constants.statusBarPriority.PROGRAMMER);
        this._uploadPortsStatusBar.command = "arduino.selectUploadSerialPort";
        this._uploadPortsStatusBar.tooltip = "Select Upload Port";
        this._uploadPortsStatusBar.show();
        this.updateUploadPortListStatus(null);
    }

    public get currentProgrammerID(): string {
        return this._programmers.get(this._currentProgrammerName);
    }

    public loadConfig() {
        this.loadProgrammers();

        this.updateStatusBar();

        const dc = DeviceContext.getInstance();
        dc.onDidChange(() => {
            this.updateStatusBar();
            this.updateUploadPortListStatus(null);
        });
    }

    public async selectProgrammer() {
        const chosen: string | undefined = await vscode.window.showQuickPick(Array.from(this._programmers.keys()),
            { placeHolder: "Select programmer" });

        if (!chosen) {
            return;
        }

        this._currentProgrammerName = chosen;

        this._programmerStatusBar.text = this._currentProgrammerName;
        const dc = DeviceContext.getInstance();
        dc.programmer = this._currentProgrammerName;
    }

    private loadProgrammers() {
        this._programmers = new Map<string, string>();
        const boardLineRegex = /([^\.]+)\.(\S+)=(.+)/;

        this._arduinoApp.boardManager.platforms.forEach(((plat) => {
            if (plat.rootBoardPath === undefined) {
                return;
            }

            const programmmerFilePath = path.join(plat.rootBoardPath, "programmers.txt");

            if (util.fileExistsSync(programmmerFilePath)) {
                const boardContent = fs.readFileSync(programmmerFilePath, "utf8");
                const lines = boardContent.split(/[\r|\r\n|\n]/);

                lines.forEach((line) => {
                    // Ignore comments.
                    if (line.startsWith("#")) {
                        return;
                    }

                    const match = boardLineRegex.exec(line);
                    if (match && match.length > 3) {
                        if (match[2] === "name") {
                            this._programmers.set(match[3], match[1]);
                        }
                    }
                });
            }
        }));
    }
    
    public async selectUploadSerialPort(vid: string, pid: string) {
        const serialMonitor = SerialMonitor.getInstance();

        serialMonitor.selectSerialPortGeneric(vid, pid, (name: string) => {
            this.updateUploadPortListStatus(name);
        });
    }

    private updateUploadPortListStatus(port: string) {
        const dc = DeviceContext.getInstance();
        if (port) {
            dc.uploadPort = port;
        }

        if (dc.uploadPort) {
            this._uploadPortsStatusBar.text = dc.uploadPort;
        } else {
            this._uploadPortsStatusBar.text = "<Select Upload Port>";
        }
    }

    private updateStatusBar(show: boolean = true): void {
        if (show) {
            this._programmerStatusBar.show();
            const dc = DeviceContext.getInstance();
            const selectedProgrammer = this._programmers.get(dc.programmer);

            if (selectedProgrammer) {
                this._currentProgrammerName = dc.programmer;
                this._programmerStatusBar.text = dc.programmer;
            } else {
                this._currentProgrammerName = null;
                this._programmerStatusBar.text = "<Select Programmer>";
            }
        } else {
            this._programmerStatusBar.hide();
        }
    }
}
