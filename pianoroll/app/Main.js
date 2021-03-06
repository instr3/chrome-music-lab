/**
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

require(["domready", "roll/Roll", "sound/Player", "interface/Interface", "Tone/core/Transport",
        "midi/preludeInC.json", "StartAudioContext", "style/main.scss", "Tone/core/Tone", "interface/Orientation", "interface/Overlay", "midiconvert/build/MidiConvert"],
    function (domReady, Roll, Player, Interface, Transport, preludeInC,
              StartAudioContext, mainStyle, Tone, Orientation, Overlay, MidiConvert) {

        domReady(function () {

            //the interface
            var player = new Player();

            var roll = new Roll(document.body);

            var interface = new Interface(document.body);

            var overlay = new Overlay(document.body, roll, interface);

            //set the first score

            var name=window.location.hash.substr(1);
            console.log(name);
            var xhr = new XMLHttpRequest();
            xhr.open("GET", name);
            xhr.responseType = "blob";
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        var reader = new FileReader();
                        reader.readAsBinaryString(xhr.response);
                        reader.onloadend = function() {
                            var midi = MidiConvert.parse(reader.result);

                            for (var k = 0; k < midi.tracks.length; k++) {
                                midi.tracks[k].notes = midi.tracks[k].notes.map(function(note) { note.track = k; return note;});
                            }

                            midi.notes = [].concat.apply([], midi.tracks.map(function(t){return t.notes;}));
                            // console.log(midi.notes)
                            midi.header.tempo = midi.header.bpm;
                            var minTime = midi.notes[0].time;
                            for (var i = 0; i < midi.notes.length; i++) {
                                minTime = Math.min(minTime, midi.notes[i].time);
                            }
                            for (var i = 0; i < midi.notes.length; i++) {
                                var t = midi.notes[i].time - minTime;
                                var d = midi.notes[i].duration;
                                midi.notes[i].time = Math.floor(t * 100) + 'i';
                                midi.notes[i].duration = Math.floor(d * 100) + 'i';
                                midi.notes[i].midiNote = midi.notes[i].midi;
                                midi.notes[i].note = midi.notes[i].name;
                            }
                            // var json = JSON.parse(xhr.responseText);
                            roll.setScore(midi);
                        };
                    } else {
                        console.log('Error: ' + xhr.status); // An error occurred during the request.
                    }
                /**
                 * EVENTS
                 */
                interface.onInstrument(function (inst) {
                    player.setInstrument(inst);
                });
                interface.onPlay(function (playing) {
                    if (playing) {
                        roll.start();
                    } else {
                        roll.stop();
                        player.releaseAll();
                    }
                });
                interface.onScore(function (json) {
                    roll.setScore(json);
                });
                interface.onJump(function (direction){
                    roll.jump(direction);
                });

                var wasPlaying = false;
                interface.onRecord(function (recording) {
                    if (recording) {
                        wasPlaying = Transport.state === "started";
                        roll.stop();
                    } else {
                        if (wasPlaying) {
                            wasPlaying = false;
                            roll.start();
                        }
                    }
                });
                interface.onBuffer(function (buffer, duration, onset) {
                    player.setBuffer(buffer, duration, onset);
                });


                roll.onnote = function (note, duration, time, velocity) {
                    player.triggerAttackRelease(note, duration, time, velocity);
                };
                roll.onstop = function () {
                    player.releaseAll();
                };

                var orientation = new Orientation(function () {
                    //called when stopped
                    Transport.stop();
                    roll.stop();
                    interface.stop();
                });

                window.parent.postMessage("loaded", "*");

                //send the ready message to the parent
                var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

                //full screen button on iOS
                if (isIOS) {
                    //make a full screen element and put it in front
                    var iOSTapper = document.createElement("div");
                    iOSTapper.id = "iOSTap";
                    document.body.appendChild(iOSTapper);
                    new StartAudioContext(Tone.context, iOSTapper).then(function() {
                        iOSTapper.remove();
                        window.parent.postMessage('ready', '*');
                    });
                } else {
                    window.parent.postMessage("ready", "*");
                }

                }
            }.bind(this);
            xhr.send(null);
            // roll.setScore(preludeInC);
        });
    });
