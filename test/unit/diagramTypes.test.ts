import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const JAVA_PATH = path.join(
  os.homedir(),
  'Library/Application Support/Code/User/globalStorage/local.markdown-studio/corretto/amazon-corretto-21.jdk/Contents/Home/bin/java'
);
const JAR_PATH = path.join(process.cwd(), 'third_party/plantuml/plantuml.jar');
const HAS_JAVA = fs.existsSync(JAVA_PATH);
const HAS_JAR = fs.existsSync(JAR_PATH) && fs.statSync(JAR_PATH).size > 1000;

function renderPlantUml(source: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puml-test-'));
  const inputFile = path.join(tmpDir, 'test.puml');
  fs.writeFileSync(inputFile, source, 'utf8');
  execSync(`"${JAVA_PATH}" -Djava.awt.headless=true -jar "${JAR_PATH}" -Playout=smetana -tsvg "${inputFile}"`, {
    timeout: 30000,
    stdio: 'pipe',
  });
  const svgFile = inputFile.replace('.puml', '.svg');
  const svg = fs.readFileSync(svgFile, 'utf8');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return svg;
}

const describeIfJava = HAS_JAVA && HAS_JAR ? describe : describe.skip;

describeIfJava('PlantUML diagram types (requires Java + JAR)', () => {
  it('sequence diagram', () => {
    const svg = renderPlantUml(`@startuml
Alice -> Bob : Hello
Bob --> Alice : Hi
@enduml`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Alice');
    expect(svg).toContain('Bob');
  });

  it('component diagram', () => {
    const svg = renderPlantUml(`@startuml
skinparam componentStyle rectangle
package "App" {
  [Frontend] --> [Backend]
  [Backend] --> [Database]
}
@enduml`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Frontend');
    expect(svg).toContain('Backend');
  });

  it('class diagram', () => {
    const svg = renderPlantUml(`@startuml
class Animal {
  +name: String
  +speak(): void
}
class Dog extends Animal {
  +fetch(): void
}
@enduml`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Animal');
    expect(svg).toContain('Dog');
  });

  it('activity diagram', () => {
    const svg = renderPlantUml(`@startuml
start
:Step 1;
if (Condition?) then (yes)
  :Step 2a;
else (no)
  :Step 2b;
endif
:Step 3;
stop
@enduml`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Step 1');
  });

  it('state diagram', () => {
    const svg = renderPlantUml(`@startuml
[*] --> Idle
Idle --> Running : start
Running --> Idle : stop
Running --> [*] : crash
@enduml`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Idle');
    expect(svg).toContain('Running');
  });

  it('use case diagram', () => {
    const svg = renderPlantUml(`@startuml
actor User
User --> (Login)
User --> (View Dashboard)
@enduml`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Login');
  });

  it('timing diagram', () => {
    const svg = renderPlantUml(`@startuml
robust "Server" as S
S is Idle
@0
S is Processing
@100
S is Idle
@enduml`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Server');
  });

  it('mind map', () => {
    const svg = renderPlantUml(`@startmindmap
* Root
** Branch A
*** Leaf 1
** Branch B
@endmindmap`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Root');
  });

  it('gantt chart', () => {
    const svg = renderPlantUml(`@startgantt
[Task 1] lasts 5 days
[Task 2] starts at [Task 1]'s end and lasts 3 days
@endgantt`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Task 1');
  });

  it('object diagram', () => {
    const svg = renderPlantUml(`@startuml
object Server {
  name = "prod-01"
  cpu = 8
}
object Client {
  name = "web-app"
}
Server <-- Client
@enduml`);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Server');
  });
});
